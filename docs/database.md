# Database

Rupa uses one SQLite file (`DATABASE_PATH`, default `./data/rupa.db`) through [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). Queries are synchronous and fast, and they are written as plain SQL. There is no ORM.

The connection enables `foreign_keys` and uses WAL journaling for file databases.

## Tables belong to features

Each feature owns its tables and prefixes them with its name (`moderation_cases`, `tickets_messages`). Other features read them through the owning feature's exports, never with their own SQL.

Core keeps its own tables under the `rupa_` prefix: `rupa_migrations`, `rupa_usage_events` ([stats.md](./stats.md)), `rupa_guild_settings` ([settings.md](./settings.md)), `rupa_sessions` ([dashboard.md](./dashboard.md)), and `rupa_jobs` and `rupa_tasks` ([jobs.md](./jobs.md)). Their migrations run before any feature's. Do not write to them directly.

## Migrations

```ts
// src/features/tickets/migrations.ts
import type { Migration } from '@/core';

export const migrations: Migration[] = [
  {
    id: '001_create_tickets',
    up: `
      CREATE TABLE tickets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        opened_by  TEXT NOT NULL,
        closed_at  TEXT
      )
    `,
  },
  {
    id: '002_backfill_topics',
    up: db => {
      // a function, for changes SQL alone cannot express
    },
  },
];
```

- Migrations are **forward-only** and run in array order. Once one has run anywhere, never edit it. Add a new one instead.
- Function migrations must be synchronous, like better-sqlite3 itself. An `async` function is rejected.
- Each migration runs in its own transaction. If it fails, nothing from it is kept, it is not recorded, and the bot does not start. The error names the feature and migration.
- Applied migrations are recorded in `rupa_migrations (feature, id, applied_at)`.
- They run automatically on every start, before the bot logs in. You can also run them by hand:

```bash
npm run migrate
npm run migrate:status
```

## Repositories

Keep a feature's SQL in one module that takes the database:

```ts
export function createTicketRepository(db: Database) {
  return {
    open(guildId: string, userId: string): number {
      const result = db
        .prepare('INSERT INTO tickets (guild_id, opened_by) VALUES (?, ?)')
        .run(guildId, userId);
      return Number(result.lastInsertRowid);
    },
  };
}
```

Handlers call it with `ctx.db`. Tests call it with an in-memory database:

```ts
const db = openDatabase(':memory:');
migrate(db, [tickets]);
const repo = createTicketRepository(db);
```
