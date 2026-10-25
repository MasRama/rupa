import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { defineFeature } from '@/core/feature';
import { createRegistry } from '@/core/routing/registry';
import { coreSchema } from '@/core/schema';
import { job, task } from '../definitions';
import { createJobScheduler } from '../scheduler';

const now = new Date('2026-10-25T12:00:00Z');
const unban = job<{ userId: string }>('unban', () => undefined);
const stray = job('stray', () => undefined);

function setup(onScheduled?: (runAt: Date) => void) {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema]);
  const registry = createRegistry([defineFeature({ name: 'moderation', jobs: [unban] })]);
  const jobs = createJobScheduler(db, registry, onScheduled);
  const rows = () =>
    db.prepare('SELECT * FROM rupa_jobs ORDER BY id').all() as {
      id: number;
      feature: string;
      name: string;
      key: string | null;
      payload: string;
      run_at: string;
      status: string;
      attempts: number;
    }[];
  return { db, jobs, rows };
}

describe('createJobScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it('stores the job with its feature, payload and run time', () => {
    const { jobs, rows } = setup();
    const id = jobs.schedule(unban, { userId: '42' }, { in: '10m' });

    expect(rows()).toEqual([
      expect.objectContaining({
        id,
        feature: 'moderation',
        name: 'unban',
        key: null,
        payload: '{"userId":"42"}',
        run_at: '2026-10-25T12:10:00.000Z',
        status: 'pending',
        attempts: 0,
      }),
    ]);
  });

  it('runs now unless told otherwise, and accepts a date or milliseconds', () => {
    const { jobs, rows } = setup();
    jobs.schedule(unban, { userId: '1' });
    jobs.schedule(unban, { userId: '2' }, { at: new Date('2026-12-01T00:00:00Z') });
    jobs.schedule(unban, { userId: '3' }, { in: 5_000 });
    expect(rows().map(row => row.run_at)).toEqual([
      '2026-10-25T12:00:00.000Z',
      '2026-12-01T00:00:00.000Z',
      '2026-10-25T12:00:05.000Z',
    ]);
  });

  it('replaces a job scheduled with the same key, keeping its id', () => {
    const { jobs, rows, db } = setup();
    const first = jobs.schedule(unban, { userId: '42' }, { in: '1d', key: 'g1:42' });
    db.prepare("UPDATE rupa_jobs SET attempts = 2, status = 'running'").run();

    const second = jobs.schedule(unban, { userId: '42' }, { in: '7d', key: 'g1:42' });
    expect(second).toBe(first);
    expect(rows()).toEqual([
      expect.objectContaining({
        run_at: '2026-11-01T12:00:00.000Z',
        status: 'pending',
        attempts: 0,
      }),
    ]);
  });

  it('keeps jobs with different keys apart', () => {
    const { jobs, rows } = setup();
    jobs.schedule(unban, { userId: '1' }, { key: 'g1:1' });
    jobs.schedule(unban, { userId: '2' }, { key: 'g1:2' });
    expect(rows()).toHaveLength(2);
  });

  it('cancels a keyed job', () => {
    const { jobs, rows } = setup();
    jobs.schedule(unban, { userId: '42' }, { in: '1d', key: 'g1:42' });
    expect(jobs.cancel(unban, 'g1:42')).toBe(true);
    expect(jobs.cancel(unban, 'g1:42')).toBe(false);
    expect(rows()).toEqual([]);
  });

  it('refuses jobs that no mounted feature declares', () => {
    const { jobs } = setup();
    expect(() => jobs.schedule(stray, {})).toThrow(
      'Job "stray" is not part of any mounted feature',
    );
  });

  it('refuses both "in" and "at", and bad durations', () => {
    const { jobs } = setup();
    expect(() => jobs.schedule(unban, { userId: '1' }, { in: '1h', at: now })).toThrow(
      'either "in" or "at"',
    );
    expect(() => jobs.schedule(unban, { userId: '1' }, { in: 'soon' })).toThrow(
      'Use a duration like',
    );
  });

  it('tells the runner when the new job is due', () => {
    const onScheduled = vi.fn();
    const { jobs } = setup(onScheduled);
    jobs.schedule(unban, { userId: '1' }, { in: '30s' });
    expect(onScheduled).toHaveBeenCalledWith(new Date('2026-10-25T12:00:30Z'));
  });
});

describe('job and task definitions', () => {
  it('need kebab-case names', () => {
    expect(() => job('Bad Name', () => undefined)).toThrow('kebab-case');
    expect(() => task('Bad Name', { every: '1h' }, () => undefined)).toThrow('kebab-case');
  });

  it('retry three times unless told otherwise', () => {
    expect(job('a', () => undefined).attempts).toBe(3);
    expect(job('a', () => undefined, { attempts: 1 }).attempts).toBe(1);
    expect(() => job('a', () => undefined, { attempts: 0 })).toThrow('at least 1');
  });

  it('check an interval when declared', () => {
    expect(() => task('t', { every: 'soon' }, () => undefined)).toThrow('Use a duration like');
  });
});

describe('registry', () => {
  it('knows which feature owns a job and finds it by name', () => {
    const registry = createRegistry([defineFeature({ name: 'moderation', jobs: [unban] })]);
    expect(registry.jobOwner(unban)).toBe('moderation');
    expect(registry.jobOwner(stray)).toBeNull();
    expect(registry.findJob('moderation', 'unban')).toBe(unban);
    expect(registry.findJob('moderation', 'nope')).toBeNull();
  });

  it('lists tasks with their feature', () => {
    const digest = task('digest', { every: '1d' }, () => undefined);
    const registry = createRegistry([defineFeature({ name: 'news', tasks: [digest] })]);
    expect(registry.tasks).toEqual([{ feature: 'news', definition: digest }]);
  });

  it('rejects two jobs or tasks with one name in a feature', () => {
    expect(() =>
      createRegistry([
        defineFeature({ name: 'a', jobs: [job('x', () => undefined), job('x', () => undefined)] }),
      ]),
    ).toThrow('Feature "a" has two jobs named "x"');
    const t = () => task('x', { every: '1h' }, () => undefined);
    expect(() => createRegistry([defineFeature({ name: 'a', tasks: [t(), t()] })])).toThrow(
      'Feature "a" has two tasks named "x"',
    );
  });

  it('rejects one job mounted by two features', () => {
    expect(() =>
      createRegistry([
        defineFeature({ name: 'a', jobs: [unban] }),
        defineFeature({ name: 'b', jobs: [unban] }),
      ]),
    ).toThrow('Job "unban" is mounted by both "a" and "b"');
  });
});
