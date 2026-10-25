import type { Migration } from '@/core';

export const migrations: Migration[] = [
  {
    id: '001_create_guilds',
    up: `
      CREATE TABLE guilds (
        id        TEXT PRIMARY KEY,
        name      TEXT NOT NULL,
        joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        left_at   TEXT
      )
    `,
  },
];
