import type { Migration } from '@/core';

export const migrations: Migration[] = [
  {
    id: '001_create_cases',
    up: `
      CREATE TABLE moderation_cases (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        action       TEXT NOT NULL CHECK (action IN ('warn', 'kick', 'ban')),
        reason       TEXT,
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX moderation_cases_member ON moderation_cases (guild_id, user_id, id);
    `,
  },
  {
    // Adds unban cases (from temporary bans) and when a temporary ban ends.
    // SQLite cannot change a CHECK constraint in place, so the table is rebuilt.
    id: '002_add_unban_and_expiry',
    up: `
      CREATE TABLE moderation_cases_next (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        action       TEXT NOT NULL CHECK (action IN ('warn', 'kick', 'ban', 'unban')),
        reason       TEXT,
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        expires_at   TEXT
      );
      INSERT INTO moderation_cases_next (id, guild_id, user_id, moderator_id, action, reason, created_at)
        SELECT id, guild_id, user_id, moderator_id, action, reason, created_at FROM moderation_cases;
      DROP TABLE moderation_cases;
      ALTER TABLE moderation_cases_next RENAME TO moderation_cases;
      CREATE INDEX moderation_cases_member ON moderation_cases (guild_id, user_id, id);
    `,
  },
];
