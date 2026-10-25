import type { Migration } from '@/core';

export const migrations: Migration[] = [
  {
    id: '001_create_items',
    up: `
      CREATE TABLE reminders_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL,
        guild_id   TEXT,
        channel_id TEXT NOT NULL,
        text       TEXT NOT NULL,
        remind_at  TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX reminders_items_user ON reminders_items (user_id, remind_at);
    `,
  },
];
