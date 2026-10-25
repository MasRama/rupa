import type { HandlerContext } from '@/core/routing/definitions';
import { nextTaskRun } from './next-run';

type Awaitable<T> = T | Promise<T>;

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function assertName(kind: 'Job' | 'Task', name: string): void {
  if (!NAME.test(name))
    throw new Error(`${kind} name "${name}" must be kebab-case, e.g. "lift-ban"`);
}

/** What a job or task receives: the handler context without route params. */
export interface JobContext extends Omit<HandlerContext, 'params'> {
  /** 1 on the first run, 2 on the first retry, and so on. Always 1 for tasks. */
  attempt: number;
}

/**
 * Work to run later, stored in SQLite so it survives restarts. A run can be
 * repeated after a crash, so make `run` safe to call twice.
 */
export interface JobDefinition<Payload = unknown> {
  readonly type: 'job';
  readonly name: string;
  /** Runs before the job is marked failed. */
  readonly attempts: number;
  run(payload: Payload, ctx: JobContext): Awaitable<void>;
}

/** Declares a job; mount it with `defineFeature({ jobs })` and schedule it with `ctx.jobs`. */
export function job<Payload = Record<string, never>>(
  name: string,
  run: JobDefinition<Payload>['run'],
  options: { attempts?: number } = {},
): JobDefinition<Payload> {
  assertName('Job', name);
  const attempts = options.attempts ?? 3;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError(`Job "${name}" needs at least 1 attempt`);
  }
  return { type: 'job', name, attempts, run };
}

/** `every: '1h'`, or a cron expression such as `0 9 * * *` in an IANA time zone. */
export type TaskSchedule = { every: string } | { cron: string; timezone?: string };

export interface TaskDefinition {
  readonly type: 'task';
  readonly name: string;
  readonly schedule: TaskSchedule;
  run(ctx: JobContext): Awaitable<void>;
}

/** Declares recurring work; mount it with `defineFeature({ tasks })`. */
export function task(
  name: string,
  schedule: TaskSchedule,
  run: TaskDefinition['run'],
): TaskDefinition {
  assertName('Task', name);
  // Throws now for a bad interval, cron expression or time zone.
  nextTaskRun(schedule, new Date());
  return { type: 'task', name, schedule, run };
}
