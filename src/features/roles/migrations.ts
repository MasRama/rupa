import type { Migration } from '@/core';

export const migrations: Migration[] = [
  {
    id: '001_create_panels',
    up: `
      CREATE TABLE roles_panels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT,
        title       TEXT NOT NULL,
        description TEXT,
        single      INTEGER NOT NULL DEFAULT 0,
        created_by  TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE TABLE roles_panel_roles (
        panel_id INTEGER NOT NULL REFERENCES roles_panels (id) ON DELETE CASCADE,
        role_id  TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (panel_id, role_id)
      );
    `,
  },
];
