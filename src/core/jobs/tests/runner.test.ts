import type { Client } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { defineFeature } from '@/core/feature';
import { createRegistry } from '@/core/routing/registry';
import { stubLogger } from '@/core/routing/tests/fixtures';
import { coreSchema } from '@/core/schema';
import { job, task, type JobContext, type TaskDefinition } from '../definitions';
import { createJobRunner, nextTaskRun } from '../runner';
import { createJobScheduler } from '../scheduler';

const start = new Date('2026-10-25T12:00:00Z');
const MINUTE = 60_000;

function setup(
  jobs: ReturnType<typeof job<never>>[] | ReturnType<typeof job<{ n: number }>>[],
  tasks: TaskDefinition[] = [],
) {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema]);
  const registry = createRegistry([defineFeature({ name: 'demo', jobs, tasks })]);
  const logger = stubLogger();
  const scheduler = createJobScheduler(db, registry);
  const runner = createJobRunner({ db, registry, logger, client: {} as Client, scheduler });
  const rows = () =>
    db.prepare('SELECT * FROM rupa_jobs ORDER BY id').all() as {
      id: number;
      status: string;
      attempts: number;
      run_at: string;
      last_error: string | null;
      payload: string;
    }[];
  return { db, registry, logger, scheduler, runner, rows };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
});
afterEach(() => vi.useRealTimers());

describe('createJobRunner', () => {
  it('runs a due job with its payload and removes it', async () => {
    const run = vi.fn();
    const work = job<{ n: number }>('work', run);
    const { scheduler, runner, rows } = setup([work]);
    scheduler.schedule(work, { n: 1 });

    expect(await runner.runDue()).toBe(1);
    expect(run).toHaveBeenCalledWith(
      { n: 1 },
      expect.objectContaining({ attempt: 1, feature: 'demo' }),
    );
    expect((run.mock.calls[0]![1] as JobContext).jobs).toBe(scheduler);
    expect(rows()).toEqual([]);
  });

  it('leaves jobs that are not due yet', async () => {
    const run = vi.fn();
    const work = job<{ n: number }>('work', run);
    const { scheduler, runner, rows } = setup([work]);
    scheduler.schedule(work, { n: 1 }, { in: '1h' });

    expect(await runner.runDue()).toBe(0);
    expect(run).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(1);
  });

  it('retries a failing job later, then marks it failed', async () => {
    const work = job<{ n: number }>(
      'work',
      () => {
        throw new Error('Discord is down');
      },
      { attempts: 2 },
    );
    const { scheduler, runner, rows } = setup([work]);
    scheduler.schedule(work, { n: 1 });

    await runner.runDue();
    expect(rows()).toEqual([
      expect.objectContaining({
        status: 'pending',
        attempts: 1,
        run_at: '2026-10-25T12:00:30.000Z',
        last_error: 'Discord is down',
      }),
    ]);

    vi.setSystemTime(new Date(start.getTime() + MINUTE));
    await runner.runDue();
    expect(rows()).toEqual([expect.objectContaining({ status: 'failed', attempts: 2 })]);
  });

  it('backs off 30 s, 2 min, then 8 min', async () => {
    const work = job<{ n: number }>(
      'work',
      () => {
        throw new Error('no');
      },
      { attempts: 4 },
    );
    const { scheduler, runner, rows } = setup([work]);
    scheduler.schedule(work, { n: 1 });

    const delays: number[] = [];
    for (let i = 0; i < 3; i++) {
      const before = Date.now();
      await runner.runDue();
      const next = Date.parse(rows()[0]!.run_at);
      delays.push(next - before);
      vi.setSystemTime(next);
    }
    expect(delays).toEqual([30_000, 120_000, 480_000]);
  });

  it('keeps a job that was rescheduled while it ran', async () => {
    const work = job<{ n: number }>('work', (payload, ctx) => {
      if (payload.n === 1) ctx.jobs.schedule(work, { n: 2 }, { in: '1h', key: 'k' });
    });
    const { scheduler, runner, rows } = setup([work]);
    scheduler.schedule(work, { n: 1 }, { key: 'k' });

    await runner.runDue();
    expect(rows()).toEqual([
      expect.objectContaining({ status: 'pending', payload: '{"n":2}', attempts: 0 }),
    ]);
  });

  it('runs a job again after a crash left it running', async () => {
    const run = vi.fn();
    const work = job<{ n: number }>('work', run);
    const { scheduler, runner, db, rows } = setup([work]);
    scheduler.schedule(work, { n: 1 });
    db.prepare("UPDATE rupa_jobs SET status = 'running', attempts = 1").run();

    await runner.start();
    await runner.stop();
    expect(run).toHaveBeenCalledWith({ n: 1 }, expect.objectContaining({ attempt: 2 }));
    expect(rows()).toEqual([]);
  });

  it('marks jobs of unmounted features as failed and carries on', async () => {
    const run = vi.fn();
    const work = job<{ n: number }>('work', run);
    const { scheduler, runner, db, rows } = setup([work]);
    db.prepare(
      `INSERT INTO rupa_jobs (feature, name, payload, run_at, status, created_at, updated_at)
       VALUES ('gone', 'old', '{}', ?, 'pending', ?, ?)`,
    ).run(start.toISOString(), start.toISOString(), start.toISOString());
    scheduler.schedule(work, { n: 1 });

    expect(await runner.runDue()).toBe(2);
    expect(run).toHaveBeenCalled();
    expect(rows()).toEqual([
      expect.objectContaining({ status: 'failed', last_error: 'No mounted job named "gone/old"' }),
    ]);
  });

  it('deletes failed jobs older than 30 days when it starts', async () => {
    const { runner, db, rows } = setup([]);
    const insert = db.prepare(
      `INSERT INTO rupa_jobs (feature, name, payload, run_at, status, created_at, updated_at)
       VALUES ('demo', 'x', '{}', ?, 'failed', ?, ?)`,
    );
    const old = new Date(start.getTime() - 31 * 24 * 60 * MINUTE).toISOString();
    const recent = new Date(start.getTime() - 2 * 24 * 60 * MINUTE).toISOString();
    insert.run(old, old, old);
    insert.run(recent, recent, recent);

    await runner.start();
    await runner.stop();
    expect(rows()).toHaveLength(1);
  });

  it('wakes up for a job scheduled sooner than its timer', async () => {
    const run = vi.fn();
    const work = job<{ n: number }>('work', run);
    const { db, registry, logger } = setup([work]);
    let runner: ReturnType<typeof createJobRunner> | null = null;
    const scheduler = createJobScheduler(db, registry, runAt => runner?.wake(runAt));
    runner = createJobRunner({ db, registry, logger, client: {} as Client, scheduler });

    await runner.start();
    scheduler.schedule(work, { n: 1 }, { in: '5s' });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(run).toHaveBeenCalledTimes(1);
    await runner.stop();
  });

  it('checks again at least every minute', async () => {
    const run = vi.fn();
    const work = job<{ n: number }>('work', run);
    const { scheduler, runner } = setup([work]);
    await runner.start();

    // Scheduled without waking the runner, e.g. by another process.
    scheduler.schedule(work, { n: 1 });
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(run).toHaveBeenCalledTimes(1);
    await runner.stop();
  });
});

describe('tasks', () => {
  it('runs a task when it is due and schedules the next run', async () => {
    const run = vi.fn();
    const hourly = task('hourly', { every: '1h' }, run);
    const { runner, db } = setup([], [hourly]);

    await runner.start();
    expect(run).not.toHaveBeenCalled();
    const next = () =>
      (db.prepare('SELECT next_run_at FROM rupa_tasks').get() as { next_run_at: string })
        .next_run_at;
    expect(next()).toBe('2026-10-25T13:00:00.000Z');

    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    expect(run).toHaveBeenCalledTimes(1);
    expect(next()).toBe('2026-10-25T14:00:00.000Z');
    await runner.stop();
  });

  it('runs a task missed while the bot was down once at start', async () => {
    const run = vi.fn();
    const hourly = task('hourly', { every: '1h' }, run);
    const { runner, db } = setup([], [hourly]);
    db.prepare(
      `INSERT INTO rupa_tasks (feature, name, schedule, next_run_at) VALUES ('demo', 'hourly', ?, ?)`,
    ).run(JSON.stringify(hourly.schedule), '2026-10-25T08:00:00.000Z');

    await runner.start();
    await runner.stop();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('recomputes the next run when the schedule changed', async () => {
    const run = vi.fn();
    const daily = task('report', { every: '1d' }, run);
    const { runner, db } = setup([], [daily]);
    db.prepare(
      `INSERT INTO rupa_tasks (feature, name, schedule, next_run_at) VALUES ('demo', 'report', ?, ?)`,
    ).run(JSON.stringify({ every: '1h' }), '2026-10-25T08:00:00.000Z');

    await runner.start();
    await runner.stop();
    expect(run).not.toHaveBeenCalled();
    const row = db.prepare('SELECT next_run_at FROM rupa_tasks').get() as { next_run_at: string };
    expect(row.next_run_at).toBe('2026-10-26T12:00:00.000Z');
  });

  it('logs a failing task and keeps its schedule', async () => {
    const broken = task('broken', { every: '1h' }, () => {
      throw new Error('nope');
    });
    const { runner, db, logger } = setup([], [broken]);
    db.prepare(
      `INSERT INTO rupa_tasks (feature, name, schedule, next_run_at) VALUES ('demo', 'broken', ?, ?)`,
    ).run(JSON.stringify(broken.schedule), start.toISOString());

    await runner.start();
    await runner.stop();
    expect(logger.error).toHaveBeenCalled();
    const row = db.prepare('SELECT next_run_at FROM rupa_tasks').get() as { next_run_at: string };
    expect(row.next_run_at).toBe('2026-10-25T13:00:00.000Z');
  });
});

describe('nextTaskRun', () => {
  it('adds an interval', () => {
    expect(nextTaskRun({ every: '1h' }, start)).toEqual(new Date('2026-10-25T13:00:00Z'));
  });

  it('follows a cron expression in a time zone', () => {
    expect(
      nextTaskRun(
        { cron: '0 9 * * *', timezone: 'Asia/Jakarta' },
        new Date('2026-10-25T03:00:00Z'),
      ),
    ).toEqual(new Date('2026-10-26T02:00:00Z'));
  });

  it('rejects a broken cron expression when the task is declared', () => {
    expect(() => task('t', { cron: 'every day' }, () => undefined)).toThrow();
  });
});
