import type { Client } from 'discord.js';
import type { Database } from '@/core/database';
import type { Logger } from '@/core/logging';
import type { FeatureRegistry } from '@/core/routing/registry';
import type { JobContext, TaskDefinition } from './definitions';
import { nextTaskRun } from './next-run';
import type { JobScheduler } from './scheduler';

export { nextTaskRun } from './next-run';

export interface JobRunnerDeps {
  db: Database;
  registry: FeatureRegistry;
  logger: Logger;
  client: Client;
  /** Handed to jobs and tasks as `ctx.jobs`. */
  scheduler: JobScheduler;
}

export interface JobRunner {
  /** Recovers interrupted jobs, runs what is overdue, then keeps watching. Call once Discord is ready. */
  start(): Promise<void>;
  /** Stops the timer and waits for the job that is running, if any. */
  stop(): Promise<void>;
  /** Called by the scheduler so a job due before the next check is not late. */
  wake(runAt: Date): void;
  /** Runs every due job and task once; returns how many ran. */
  runDue(): Promise<number>;
}

interface JobRow {
  id: number;
  feature: string;
  name: string;
  payload: string;
  attempts: number;
}

interface TaskRow {
  feature: string;
  name: string;
  schedule: string;
  next_run_at: string;
}

/** The runner checks at least this often, so jobs added by another process are picked up. */
const MAX_SLEEP_MS = 60_000;
const RETRY_BASE_MS = 30_000;
const FAILED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createJobRunner({
  db,
  registry,
  logger,
  client,
  scheduler,
}: JobRunnerDeps): JobRunner {
  const iso = () => new Date().toISOString();
  const context = (feature: string, attempt: number): JobContext => ({
    db,
    logger: logger.child({ feature }),
    client,
    registry,
    feature,
    jobs: scheduler,
    attempt,
  });

  const nextDueJob = db.prepare(
    `SELECT id, feature, name, payload, attempts FROM rupa_jobs
     WHERE status = 'pending' AND run_at <= ? ORDER BY run_at, id LIMIT 1`,
  );
  const markRunning = db.prepare(
    "UPDATE rupa_jobs SET status = 'running', attempts = ?, updated_at = ? WHERE id = ?",
  );
  // Each outcome only touches the row while it is still this run's: a job
  // rescheduled with the same key during its run is left alone.
  const complete = db.prepare("DELETE FROM rupa_jobs WHERE id = ? AND status = 'running'");
  const retry = db.prepare(
    `UPDATE rupa_jobs SET status = 'pending', run_at = ?, last_error = ?, updated_at = ?
     WHERE id = ? AND status = 'running'`,
  );
  const fail = db.prepare(
    `UPDATE rupa_jobs SET status = 'failed', last_error = ?, updated_at = ?
     WHERE id = ? AND status = 'running'`,
  );

  async function runJob(row: JobRow): Promise<void> {
    const attempt = row.attempts + 1;
    markRunning.run(attempt, iso(), row.id);
    const label = `${row.feature}/${row.name}`;
    const definition = registry.findJob(row.feature, row.name);
    if (!definition) {
      logger.warn({ job: label, id: row.id }, 'No mounted job for a scheduled job');
      fail.run(`No mounted job named "${label}"`, iso(), row.id);
      return;
    }

    try {
      await definition.run(JSON.parse(row.payload), context(row.feature, attempt));
      complete.run(row.id);
    } catch (error) {
      const finalAttempt = attempt >= definition.attempts;
      logger.error({ err: error, job: label, id: row.id, attempt }, 'Job failed');
      if (finalAttempt) {
        fail.run(errorMessage(error), iso(), row.id);
      } else {
        const delay = RETRY_BASE_MS * 4 ** (attempt - 1);
        retry.run(new Date(Date.now() + delay).toISOString(), errorMessage(error), iso(), row.id);
      }
    }
  }

  const tasksByKey = new Map(
    registry.tasks.map(({ feature, definition }) => [`${feature}/${definition.name}`, definition]),
  );

  function syncTasks(): void {
    const now = new Date();
    const stored = new Map(
      (db.prepare('SELECT feature, name, schedule FROM rupa_tasks').all() as TaskRow[]).map(row => [
        `${row.feature}/${row.name}`,
        row.schedule,
      ]),
    );
    const upsert = db.prepare(
      `INSERT INTO rupa_tasks (feature, name, schedule, next_run_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (feature, name) DO UPDATE SET schedule = excluded.schedule, next_run_at = excluded.next_run_at`,
    );
    const remove = db.prepare('DELETE FROM rupa_tasks WHERE feature = ? AND name = ?');

    db.transaction(() => {
      for (const { feature, definition } of registry.tasks) {
        const key = `${feature}/${definition.name}`;
        const schedule = JSON.stringify(definition.schedule);
        // A task already stored with this schedule keeps its next run, even an overdue one.
        if (stored.get(key) !== schedule) {
          upsert.run(
            feature,
            definition.name,
            schedule,
            nextTaskRun(definition.schedule, now).toISOString(),
          );
        }
        stored.delete(key);
      }
      for (const key of stored.keys()) {
        const [feature, name] = key.split('/') as [string, string];
        remove.run(feature, name);
      }
    })();
  }

  async function runTask(feature: string, definition: TaskDefinition): Promise<void> {
    try {
      await definition.run(context(feature, 1));
    } catch (error) {
      logger.error({ err: error, task: `${feature}/${definition.name}` }, 'Task failed');
    }
    const now = new Date();
    db.prepare(
      'UPDATE rupa_tasks SET last_run_at = ?, next_run_at = ? WHERE feature = ? AND name = ?',
    ).run(
      now.toISOString(),
      nextTaskRun(definition.schedule, now).toISOString(),
      feature,
      definition.name,
    );
  }

  let started = false;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let armedFor = Infinity;
  let active: Promise<void> | null = null;

  async function runDue(): Promise<number> {
    let ran = 0;
    for (let row = nextDueJob.get(iso()) as JobRow | undefined; row && !stopped;) {
      await runJob(row);
      ran++;
      row = nextDueJob.get(iso()) as JobRow | undefined;
    }

    const dueTasks = db
      .prepare('SELECT feature, name FROM rupa_tasks WHERE next_run_at <= ?')
      .all(iso()) as Pick<TaskRow, 'feature' | 'name'>[];
    for (const { feature, name } of dueTasks) {
      const definition = tasksByKey.get(`${feature}/${name}`);
      if (!definition || stopped) continue;
      await runTask(feature, definition);
      ran++;
    }
    return ran;
  }

  function nextDueAt(): number {
    const job = db
      .prepare("SELECT MIN(run_at) AS at FROM rupa_jobs WHERE status = 'pending'")
      .get() as { at: string | null };
    const task = db.prepare('SELECT MIN(next_run_at) AS at FROM rupa_tasks').get() as {
      at: string | null;
    };
    const times = [job.at, task.at].filter((at): at is string => at !== null).map(Date.parse);
    return Math.min(Date.now() + MAX_SLEEP_MS, ...times);
  }

  function arm(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    if (stopped) return;
    armedFor = nextDueAt();
    timer = setTimeout(() => void tick(), Math.max(0, armedFor - Date.now()));
    timer.unref();
  }

  function tick(): Promise<void> {
    active ??= runDue()
      .then(
        () => undefined,
        error => logger.error({ err: error }, 'Job runner failed'),
      )
      .finally(() => {
        active = null;
        arm();
      });
    return active;
  }

  return {
    runDue,

    async start() {
      if (started) return;
      started = true;
      const recovered = db
        .prepare("UPDATE rupa_jobs SET status = 'pending' WHERE status = 'running'")
        .run().changes;
      if (recovered > 0)
        logger.warn({ jobs: recovered }, 'Re-running jobs interrupted by a restart');
      db.prepare("DELETE FROM rupa_jobs WHERE status = 'failed' AND updated_at < ?").run(
        new Date(Date.now() - FAILED_RETENTION_MS).toISOString(),
      );
      syncTasks();
      await tick();
    },

    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      await active;
    },

    wake(runAt) {
      if (!started || stopped || active) return;
      if (runAt.getTime() < armedFor) arm();
    },
  };
}
