import type { Migration } from '@/core';

export const migrations: Migration[] = [
  {
    id: '001_create_tickets',
    up: `
      CREATE TABLE tickets_tickets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        thread_id  TEXT UNIQUE,
        opener_id  TEXT NOT NULL,
        subject    TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        closed_at  TEXT,
        closed_by  TEXT
      );
      CREATE INDEX tickets_tickets_opener ON tickets_tickets (guild_id, opener_id, status);
      CREATE INDEX tickets_tickets_status ON tickets_tickets (status);
    `,
  },
];
