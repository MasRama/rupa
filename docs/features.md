# Features

A feature is one capability of the bot (moderation, tickets, leveling) kept in one folder.

```text
src/features/tickets/
├── index.ts          # defineFeature(...): the feature's public boundary
├── commands/         # slash commands
├── components/       # buttons, select menus, modals
├── events/           # gateway event handlers
├── repository.ts     # SQL for the feature's tables
├── migrations.ts     # the feature's schema history
└── tests/
```

Only `index.ts` is public. Another feature may import what `index.ts` exports, but never files inside the folder. That keeps a feature removable: delete the folder, remove it from `src/app/features.ts`, done.

## Defining a feature

```ts
import { GatewayIntentBits } from 'discord.js';
import { defineFeature } from '@/core';

export const tickets = defineFeature({
  name: 'tickets', // kebab-case and unique
  intents: [GatewayIntentBits.GuildMembers], // only if you need more than Guilds
  commands: [openTicket, closeTicket],
  components: [closeButton, topicSelect, detailsModal],
  events: [memberLeft],
  migrations,
});
```

Every list is optional.

## Mounting it

```ts
// src/app/features.ts
import { tickets } from '@/features/tickets';

export const features: Feature[] = [general, moderation, guilds, tickets];
```

Order matters in three places. Migrations run in this order, component routes are matched in this order, and `/help` lists features in this order.

At startup Rupa refuses to run if two features register the same slash command name, the same component route of the same kind, or the same feature name. The error names both features.

## Scaffolding

```bash
npm run rupa -- make feature tickets
```

This creates `index.ts`, a `/tickets` command, an empty `migrations.ts` and a test. It then prints the two lines to add to `src/app/features.ts`. Rupa does not edit the composition root for you.

## Handler context

Every handler receives a context after its Discord arguments:

| Field | What it is |
| --- | --- |
| `ctx.params` | Values captured from the component's route (empty for commands and events) |
| `ctx.db` | The shared `better-sqlite3` database |
| `ctx.logger` | A pino logger tagged with the feature name |
| `ctx.client` | The discord.js client |
| `ctx.registry` | Everything mounted, e.g. for a help command |
| `ctx.feature` | The owning feature's name |

## Testing a feature

Put pure logic (permission rules, formatting, SQL) in plain functions and test them with Vitest. Repositories can run against `openDatabase(':memory:')` after `migrate(db, [yourFeature])`. See `src/features/moderation/tests` for both kinds.
