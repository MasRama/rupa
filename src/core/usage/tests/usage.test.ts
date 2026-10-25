import { describe, expect, it, vi } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { stubLogger } from '@/core/routing/tests/fixtures';
import { coreSchema } from '@/core/schema';
import {
  createUsageQueries,
  createUsageRecorder,
  pruneUsage,
  scheduleUsagePruning,
  sparkline,
  usageWindow,
  type UsageEvent,
} from '../index';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-25T12:00:00Z');

function setup(trackUsers = false) {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema]);
  return {
    db,
    recorder: createUsageRecorder(db, { trackUsers }),
    queries: createUsageQueries(db),
  };
}

const event = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  at: now,
  feature: 'moderation',
  kind: 'command',
  target: '/ban',
  guildId: 'g1',
  userId: 'u1',
  outcome: 'ok',
  durationMs: 100,
  ...overrides,
});

const lastWeek = { since: new Date(now.getTime() - 7 * DAY), until: now };

describe('usage store', () => {
  it('summarises uses, errors, average duration and servers', () => {
    const { recorder, queries } = setup();
    recorder.record(event({ durationMs: 100 }));
    recorder.record(event({ durationMs: 300, outcome: 'error', guildId: 'g2' }));

    expect(queries.summary(lastWeek)).toEqual({
      uses: 2,
      errors: 1,
      avgMs: 200,
      guilds: 2,
      users: null,
      blocked: 0,
    });
  });

  it('counts unique users only when user ids were stored', () => {
    const { recorder, queries, db } = setup(true);
    recorder.record(event({ userId: 'u1' }));
    recorder.record(event({ userId: 'u1' }));
    recorder.record(event({ userId: 'u2' }));
    expect(queries.summary(lastWeek).users).toBe(2);

    const untracked = createUsageRecorder(db, { trackUsers: false });
    untracked.record(event({ userId: 'u3' }));
    const stored = db
      .prepare('SELECT COUNT(*) AS n FROM rupa_usage_events WHERE user_id = ?')
      .get('u3') as { n: number };
    expect(stored.n).toBe(0);
  });

  it('ranks targets by uses', () => {
    const { recorder, queries } = setup();
    recorder.record(event({ target: '/ping', feature: 'general' }));
    recorder.record(event({ target: '/ban' }));
    recorder.record(event({ target: '/ban', outcome: 'error' }));

    expect(queries.byTarget(lastWeek, 10)).toEqual([
      {
        feature: 'moderation',
        kind: 'command',
        target: '/ban',
        uses: 2,
        errors: 1,
        blocked: 0,
        avgMs: 100,
      },
      {
        feature: 'general',
        kind: 'command',
        target: '/ping',
        uses: 1,
        errors: 0,
        blocked: 0,
        avgMs: 100,
      },
    ]);
  });

  it('groups by feature', () => {
    const { recorder, queries } = setup();
    recorder.record(event({ feature: 'general', target: '/ping' }));
    recorder.record(event());
    recorder.record(event({ kind: 'button', target: 'moderation:ban/:userId/:days' }));

    expect(queries.byFeature(lastWeek)).toEqual([
      { feature: 'moderation', uses: 2, errors: 0, blocked: 0 },
      { feature: 'general', uses: 1, errors: 0, blocked: 0 },
    ]);
  });

  it('scopes every query to one guild', () => {
    const { recorder, queries } = setup();
    recorder.record(event({ guildId: 'g1' }));
    recorder.record(event({ guildId: 'g2' }));
    recorder.record(event({ guildId: null }));

    expect(queries.summary({ ...lastWeek, guildId: 'g1' }).uses).toBe(1);
    expect(queries.byTarget({ ...lastWeek, guildId: 'g2' }, 10)[0]?.uses).toBe(1);
  });

  it('ignores events outside the range', () => {
    const { recorder, queries } = setup();
    recorder.record(event({ at: new Date(now.getTime() - 8 * DAY) }));
    recorder.record(event());
    expect(queries.summary(lastWeek).uses).toBe(1);
  });

  it('returns one row per day with idle days filled with zero', () => {
    const { recorder, queries } = setup();
    recorder.record(event({ at: new Date('2026-10-23T08:00:00Z') }));
    recorder.record(event({ at: new Date('2026-10-23T09:00:00Z'), outcome: 'error' }));
    recorder.record(event({ at: new Date('2026-10-25T10:00:00Z') }));

    expect(queries.daily({ since: new Date('2026-10-22T00:00:00Z'), until: now })).toEqual([
      { day: '2026-10-22', uses: 0, errors: 0 },
      { day: '2026-10-23', uses: 2, errors: 1 },
      { day: '2026-10-24', uses: 0, errors: 0 },
      { day: '2026-10-25', uses: 1, errors: 0 },
    ]);
  });

  it('prunes events older than the retention window', () => {
    const { db, recorder, queries } = setup();
    recorder.record(event({ at: new Date(now.getTime() - 100 * DAY) }));
    recorder.record(event({ at: new Date(now.getTime() - 10 * DAY) }));

    expect(pruneUsage(db, 90, now)).toBe(1);
    expect(queries.summary({ since: new Date(0), until: now }).uses).toBe(1);
  });
});

describe('blocked interactions', () => {
  it('counts them apart from uses, errors and timings', () => {
    const { recorder, queries } = setup();
    recorder.record(event({ durationMs: 100 }));
    recorder.record(event({ durationMs: 300 }));
    recorder.record(event({ durationMs: 200, outcome: 'error' }));
    for (let i = 0; i < 3; i++) recorder.record(event({ outcome: 'blocked', durationMs: 0 }));

    expect(queries.summary(lastWeek)).toMatchObject({ uses: 3, errors: 1, blocked: 3, avgMs: 200 });
    expect(queries.byFeature(lastWeek)).toEqual([
      { feature: 'moderation', uses: 3, errors: 1, blocked: 3 },
    ]);
    expect(queries.daily({ since: new Date('2026-10-25T00:00:00Z'), until: now })).toEqual([
      { day: '2026-10-25', uses: 3, errors: 1 },
    ]);
  });

  it('lists a target that was only ever blocked', () => {
    const { recorder, queries } = setup();
    recorder.record(event({ target: '/daily', outcome: 'blocked', durationMs: 0 }));
    recorder.record(event({ target: '/daily', outcome: 'blocked', durationMs: 0 }));

    expect(queries.byTarget(lastWeek, 10)).toEqual([
      {
        feature: 'moderation',
        kind: 'command',
        target: '/daily',
        uses: 0,
        errors: 0,
        blocked: 2,
        avgMs: 0,
      },
    ]);
  });

  it('keeps events recorded before blocked outcomes existed', () => {
    const db = openDatabase(':memory:');
    const before = { ...coreSchema, migrations: coreSchema.migrations!.slice(0, 3) };
    migrate(db, [before]);
    createUsageRecorder(db, { trackUsers: false }).record(event());

    migrate(db, [coreSchema]);
    expect(createUsageQueries(db).summary(lastWeek).uses).toBe(1);
    createUsageRecorder(db, { trackUsers: false }).record(event({ outcome: 'blocked' }));
    expect(createUsageQueries(db).summary(lastWeek).blocked).toBe(1);
  });
});

describe('scheduleUsagePruning', () => {
  it('prunes now and then once a day until stopped', () => {
    vi.useFakeTimers({ now });
    try {
      const { db, recorder } = setup();
      const logger = stubLogger();
      const stop = scheduleUsagePruning(db, { retentionDays: 1, logger });

      recorder.record(event({ at: new Date(now.getTime() - 2 * DAY) }));
      recorder.record(event());
      vi.advanceTimersByTime(DAY);
      expect(db.prepare('SELECT COUNT(*) AS n FROM rupa_usage_events').get()).toEqual({ n: 1 });

      stop();
      recorder.record(event({ at: new Date(now.getTime() - 3 * DAY) }));
      vi.advanceTimersByTime(DAY);
      expect(db.prepare('SELECT COUNT(*) AS n FROM rupa_usage_events').get()).toEqual({ n: 2 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('sparkline', () => {
  it('scales values to block characters, keeping zero at the floor', () => {
    expect(sparkline([0, 1, 2, 4])).toBe('▁▃▅█');
  });

  it('draws a flat line when nothing happened', () => {
    expect(sparkline([0, 0, 0])).toBe('▁▁▁');
  });
});

describe('usageWindow', () => {
  it('covers exactly the last N calendar days in UTC, today included', () => {
    const range = usageWindow(7, now);
    expect(range).toEqual({ since: new Date('2026-10-19T00:00:00Z'), until: now });

    const { queries } = setup();
    expect(queries.daily(range)).toHaveLength(7);
  });
});
