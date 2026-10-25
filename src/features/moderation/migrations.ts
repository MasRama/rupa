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
];
