import type { Database } from '@/core';

export interface TrackedGuild {
  id: string;
  name: string;
  joinedAt: string;
  leftAt: string | null;
}

interface GuildRow {
  id: string;
  name: string;
  joined_at: string;
  left_at: string | null;
}

export function createGuildRepository(db: Database) {
  return {
    /** Records that the bot is in this guild (first join, rejoin or rename). */
    joined(id: string, name: string): void {
      db.prepare(
        `INSERT INTO guilds (id, name) VALUES (?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name,
           joined_at = CASE WHEN guilds.left_at IS NULL THEN guilds.joined_at ELSE excluded.joined_at END,
           left_at = NULL`,
      ).run(id, name);
    },

    left(id: string): void {
      db.prepare(
        `UPDATE guilds SET left_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND left_at IS NULL`,
      ).run(id);
    },

    find(id: string): TrackedGuild | null {
      const row = db.prepare('SELECT * FROM guilds WHERE id = ?').get(id) as GuildRow | undefined;
      return row
        ? { id: row.id, name: row.name, joinedAt: row.joined_at, leftAt: row.left_at }
        : null;
    },

    countActive(): number {
      const row = db
        .prepare('SELECT COUNT(*) AS total FROM guilds WHERE left_at IS NULL')
        .get() as {
        total: number;
      };
      return row.total;
    },
  };
}
