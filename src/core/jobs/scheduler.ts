import type { Database } from '@/core/database';
import type { FeatureRegistry } from '@/core/routing/registry';
import { parseDuration } from '@/core/time';
import type { JobDefinition } from './definitions';

export interface ScheduleOptions {
  /** Delay before the job runs: `'10m'`, `'7d'` or milliseconds. */
  in?: string | number;
  /** Exact time to run. Leave out both `in` and `at` to run as soon as possible. */
  at?: Date;
  /** Scheduling again with the same key replaces the pending job instead of adding one. */
  key?: string;
}

export interface JobScheduler {
  /** Stores the job and returns its id. */
  schedule<Payload>(
    job: JobDefinition<Payload>,
    payload: Payload,
    options?: ScheduleOptions,
  ): number;
  /** Removes the job with this key; returns whether there was one. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cancel(job: JobDefinition<any>, key: string): boolean;
}

/** `onScheduled` lets the runner wake up early for a job due sooner than its timer. */
export function createJobScheduler(
  db: Database,
  registry: FeatureRegistry,
  onScheduled?: (runAt: Date) => void,
): JobScheduler {
  const owner = (job: JobDefinition<unknown>): string => {
    const feature = registry.jobOwner(job);
    if (!feature) throw new Error(`Job "${job.name}" is not part of any mounted feature`);
    return feature;
  };

  return {
    schedule(job, payload, options = {}) {
      const feature = owner(job as JobDefinition<unknown>);
      if (options.in !== undefined && options.at !== undefined) {
        throw new Error('Pass either "in" or "at", not both');
      }
      const delay =
        options.in === undefined
          ? 0
          : typeof options.in === 'number'
            ? options.in
            : parseDuration(options.in);
      const runAt = options.at ?? new Date(Date.now() + delay);
      if (Number.isNaN(runAt.getTime())) throw new RangeError('The job has an invalid run time');

      const now = new Date().toISOString();
      const { id } = db
        .prepare(
          `INSERT INTO rupa_jobs (feature, name, key, payload, run_at, status, attempts, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
           ON CONFLICT (feature, name, key) WHERE key IS NOT NULL DO UPDATE SET
             payload = excluded.payload, run_at = excluded.run_at, status = 'pending',
             attempts = 0, last_error = NULL, updated_at = excluded.updated_at
           RETURNING id`,
        )
        .get(
          feature,
          job.name,
          options.key ?? null,
          JSON.stringify(payload ?? null),
          runAt.toISOString(),
          now,
          now,
        ) as { id: number };
      onScheduled?.(runAt);
      return id;
    },

    cancel(job, key) {
      const feature = owner(job);
      return (
        db
          .prepare('DELETE FROM rupa_jobs WHERE feature = ? AND name = ? AND key = ?')
          .run(feature, job.name, key).changes > 0
      );
    },
  };
}
