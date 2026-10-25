import type { Database } from '@/core/database';

export type UsageKind = 'command' | 'button' | 'select' | 'modal';
export type UsageOutcome = 'ok' | 'error';

/** One handled interaction. `target` is "/cmd sub" or a route pattern, never a raw custom id. */
export interface UsageEvent {
  at: Date;
  feature: string;
  kind: UsageKind;
  target: string;
  guildId: string | null;
  userId: string | null;
  outcome: UsageOutcome;
  durationMs: number;
}

export interface UsageRecorder {
  record(event: UsageEvent): void;
}

export interface UsageOptions {
  /** Store user ids. Off by default: per-user data needs a privacy policy. */
  trackUsers: boolean;
}

/** Time window for queries, optionally limited to one server. `until` defaults to now. */
export interface UsageRange {
  since: Date;
  until?: Date;
  guildId?: string;
}

export interface UsageSummary {
  uses: number;
  errors: number;
  avgMs: number;
  guilds: number;
  /** Unique users, or `null` when user tracking is off. */
  users: number | null;
}

export interface TargetUsage {
  feature: string;
  kind: UsageKind;
  target: string;
  uses: number;
  errors: number;
  avgMs: number;
}

export interface FeatureUsage {
  feature: string;
  uses: number;
  errors: number;
}

export interface DailyUsage {
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  uses: number;
  errors: number;
}

export interface UsageQueries {
  summary(range: UsageRange): UsageSummary;
  byTarget(range: UsageRange, limit: number): TargetUsage[];
  byFeature(range: UsageRange): FeatureUsage[];
  /** One row per UTC day in the range, idle days included with zeros. */
  daily(range: UsageRange): DailyUsage[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createUsageRecorder(db: Database, options: UsageOptions): UsageRecorder {
  const insert = db.prepare(`
    INSERT INTO rupa_usage_events (at, feature, kind, target, guild_id, user_id, outcome, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return {
    record(event) {
      insert.run(
        event.at.toISOString(),
        event.feature,
        event.kind,
        event.target,
        event.guildId,
        options.trackUsers ? event.userId : null,
        event.outcome,
        Math.max(0, Math.round(event.durationMs)),
      );
    },
  };
}

function where(range: UsageRange): { sql: string; params: string[] } {
  const params = [range.since.toISOString(), (range.until ?? new Date()).toISOString()];
  let sql = 'WHERE at >= ? AND at <= ?';
  if (range.guildId !== undefined) {
    sql += ' AND guild_id = ?';
    params.push(range.guildId);
  }
  return { sql, params };
}

const ERRORS = "SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END)";

export function createUsageQueries(db: Database, options: UsageOptions): UsageQueries {
  return {
    summary(range) {
      const { sql, params } = where(range);
      const row = db
        .prepare(
          `SELECT COUNT(*) AS uses, COALESCE(${ERRORS}, 0) AS errors,
                  COALESCE(ROUND(AVG(duration_ms)), 0) AS avgMs,
                  COUNT(DISTINCT guild_id) AS guilds, COUNT(DISTINCT user_id) AS users
           FROM rupa_usage_events ${sql}`,
        )
        .get(...params) as Omit<UsageSummary, 'users'> & { users: number };
      return { ...row, users: options.trackUsers ? row.users : null };
    },

    byTarget(range, limit) {
      const { sql, params } = where(range);
      return db
        .prepare(
          `SELECT feature, kind, target, COUNT(*) AS uses, ${ERRORS} AS errors,
                  ROUND(AVG(duration_ms)) AS avgMs
           FROM rupa_usage_events ${sql}
           GROUP BY feature, kind, target
           ORDER BY uses DESC, target ASC
           LIMIT ?`,
        )
        .all(...params, limit) as TargetUsage[];
    },

    byFeature(range) {
      const { sql, params } = where(range);
      return db
        .prepare(
          `SELECT feature, COUNT(*) AS uses, ${ERRORS} AS errors
           FROM rupa_usage_events ${sql}
           GROUP BY feature
           ORDER BY uses DESC, feature ASC`,
        )
        .all(...params) as FeatureUsage[];
    },

    daily(range) {
      const { sql, params } = where(range);
      const rows = db
        .prepare(
          `SELECT substr(at, 1, 10) AS day, COUNT(*) AS uses, ${ERRORS} AS errors
           FROM rupa_usage_events ${sql}
           GROUP BY day`,
        )
        .all(...params) as DailyUsage[];
      const byDay = new Map(rows.map(row => [row.day, row]));

      const days: DailyUsage[] = [];
      const until = range.until ?? new Date();
      const cursor = new Date(range.since.toISOString().slice(0, 10) + 'T00:00:00Z');
      while (cursor.getTime() <= until.getTime()) {
        const day = cursor.toISOString().slice(0, 10);
        days.push(byDay.get(day) ?? { day, uses: 0, errors: 0 });
        cursor.setTime(cursor.getTime() + DAY_MS);
      }
      return days;
    },
  };
}

/** Deletes events older than `retentionDays`; returns how many were removed. */
export function pruneUsage(db: Database, retentionDays: number, now: Date = new Date()): number {
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS).toISOString();
  return db.prepare('DELETE FROM rupa_usage_events WHERE at < ?').run(cutoff).changes;
}
