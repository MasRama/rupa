import { Cron } from 'croner';
import { parseDuration } from '@/core/time';
import type { TaskSchedule } from './definitions';

/** When a task with this schedule runs next, after `from`. */
export function nextTaskRun(schedule: TaskSchedule, from: Date): Date {
  if ('every' in schedule) return new Date(from.getTime() + parseDuration(schedule.every));
  const cron = new Cron(schedule.cron, {
    paused: true,
    ...(schedule.timezone && { timezone: schedule.timezone }),
  });
  const next = cron.nextRun(from);
  if (!next) throw new RangeError(`Cron "${schedule.cron}" never runs again`);
  return next;
}
