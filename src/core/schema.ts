import type { MigrationSource } from '@/core/database';

/** Name of core's own migration source; features may not use it. */
export const CORE_SCHEMA_NAME = 'rupa';

/** Tables owned by core itself. Migrate it before the features. */
export const coreSchema: MigrationSource = {
  name: CORE_SCHEMA_NAME,
  migrations: [
    {
      id: '001_create_usage_events',
      up: `
        CREATE TABLE rupa_usage_events (
          id          INTEGER PRIMARY KEY,
          at          TEXT NOT NULL,
          feature     TEXT NOT NULL,
          kind        TEXT NOT NULL CHECK (kind IN ('command', 'button', 'select', 'modal')),
          target      TEXT NOT NULL,
          guild_id    TEXT,
          user_id     TEXT,
          outcome     TEXT NOT NULL CHECK (outcome IN ('ok', 'error')),
          duration_ms INTEGER NOT NULL
        );
        CREATE INDEX rupa_usage_events_at ON rupa_usage_events (at);
        CREATE INDEX rupa_usage_events_guild_at ON rupa_usage_events (guild_id, at);
      `,
    },
    {
      id: '002_create_guild_settings',
      up: `
        CREATE TABLE rupa_guild_settings (
          guild_id   TEXT NOT NULL,
          feature    TEXT NOT NULL,
          key        TEXT NOT NULL,
          value      TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          PRIMARY KEY (guild_id, feature, key)
        );
      `,
    },
  ],
};
