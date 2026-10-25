import type { Database } from '@/core';

export interface NewReminder {
  userId: string;
  /** Null when the reminder was set in a DM. */
  guildId: string | null;
  channelId: string;
  text: string;
  remindAt: Date;
}

export interface Reminder {
  id: number;
  userId: string;
  guildId: string | null;
  channelId: string;
  text: string;
  /** ISO timestamp. */
  remindAt: string;
}

interface ReminderRow {
  id: number;
  user_id: string;
  guild_id: string | null;
  channel_id: string;
  text: string;
  remind_at: string;
}

const toReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  userId: row.user_id,
  guildId: row.guild_id,
  channelId: row.channel_id,
  text: row.text,
  remindAt: row.remind_at,
});

const COLUMNS = 'id, user_id, guild_id, channel_id, text, remind_at';

export function createReminderRepository(db: Database) {
  return {
    /** Stores a reminder and returns its number. */
    add(entry: NewReminder): number {
      const result = db
        .prepare(
          `INSERT INTO reminders_items (user_id, guild_id, channel_id, text, remind_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          entry.userId,
          entry.guildId,
          entry.channelId,
          entry.text,
          entry.remindAt.toISOString(),
        );
      return Number(result.lastInsertRowid);
    },

    get(id: number): Reminder | null {
      const row = db.prepare(`SELECT ${COLUMNS} FROM reminders_items WHERE id = ?`).get(id) as
        ReminderRow | undefined;
      return row ? toReminder(row) : null;
    },

    /** A user's reminders, soonest first. */
    listForUser(userId: string, limit = -1, offset = 0): Reminder[] {
      const rows = db
        .prepare(
          `SELECT ${COLUMNS} FROM reminders_items WHERE user_id = ?
           ORDER BY remind_at, id LIMIT ? OFFSET ?`,
        )
        .all(userId, limit, offset) as ReminderRow[];
      return rows.map(toReminder);
    },

    countForUser(userId: string): number {
      const row = db
        .prepare('SELECT COUNT(*) AS n FROM reminders_items WHERE user_id = ?')
        .get(userId) as { n: number };
      return row.n;
    },

    /** Removes one of the user's own reminders; returns whether it existed. */
    remove(id: number, userId: string): boolean {
      return (
        db.prepare('DELETE FROM reminders_items WHERE id = ? AND user_id = ?').run(id, userId)
          .changes > 0
      );
    },

    /** Forgets a reminder once it has been delivered. */
    delete(id: number): void {
      db.prepare('DELETE FROM reminders_items WHERE id = ?').run(id);
    },
  };
}
