import type { Database } from '@/core';

export type CaseAction = 'warn' | 'kick' | 'ban' | 'unban';

export interface NewCase {
  guildId: string;
  userId: string;
  moderatorId: string;
  action: CaseAction;
  reason: string | null;
  /** When a temporary ban ends, as an ISO timestamp. */
  expiresAt?: string | null;
}

export interface ModerationCase extends NewCase {
  id: number;
  createdAt: string;
  expiresAt: string | null;
}

interface CaseRow {
  id: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  action: CaseAction;
  reason: string | null;
  created_at: string;
  expires_at: string | null;
}

const toCase = (row: CaseRow): ModerationCase => ({
  id: row.id,
  guildId: row.guild_id,
  userId: row.user_id,
  moderatorId: row.moderator_id,
  action: row.action,
  reason: row.reason,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

export function createCaseRepository(db: Database) {
  return {
    /** Records a moderation action and returns its case number. */
    add(entry: NewCase): number {
      const result = db
        .prepare(
          `INSERT INTO moderation_cases (guild_id, user_id, moderator_id, action, reason, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          entry.guildId,
          entry.userId,
          entry.moderatorId,
          entry.action,
          entry.reason,
          entry.expiresAt ?? null,
        );
      return Number(result.lastInsertRowid);
    },

    /** A member's cases in one guild, newest first. */
    listForMember(guildId: string, userId: string, limit = 10): ModerationCase[] {
      const rows = db
        .prepare(
          `SELECT * FROM moderation_cases
           WHERE guild_id = ? AND user_id = ?
           ORDER BY id DESC LIMIT ?`,
        )
        .all(guildId, userId, limit) as CaseRow[];
      return rows.map(toCase);
    },

    countForMember(guildId: string, userId: string): number {
      const row = db
        .prepare(
          'SELECT COUNT(*) AS total FROM moderation_cases WHERE guild_id = ? AND user_id = ?',
        )
        .get(guildId, userId) as { total: number };
      return row.total;
    },
  };
}
