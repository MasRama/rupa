# Features

A feature is one capability of the bot (moderation, tickets, leveling) kept in one folder.

```text
src/features/tickets/
├── index.ts          # defineFeature(...): the feature's public boundary
├── commands/         # slash and right-click commands
├── components/       # buttons, select menus, modals
├── events/           # gateway event handlers
├── jobs.ts           # scheduled and recurring work
├── repository.ts     # SQL for the feature's tables
├── migrations.ts     # the feature's schema history
└── tests/
```

Only `index.ts` is public. Another feature may import what `index.ts` exports, but never files inside the folder. That keeps a feature removable: delete the folder, remove it from `src/app/features.ts`, done.

## Defining a feature

```ts
import { GatewayIntentBits } from 'discord.js';
import { cooldown, defineFeature } from '@/core';

export const tickets = defineFeature({
  name: 'tickets', // kebab-case and unique
  intents: [GatewayIntentBits.GuildMembers], // only if you need more than Guilds
  commands: [openTicket, closeTicket, reportTicketMenu], // slash and right-click commands
  components: [closeButton, topicSelect, detailsModal],
  events: [memberLeft],
  guards: [cooldown('3s')], // run before every command and component, see guards.md
  jobs: [closeStale], // work scheduled for later, see jobs.md
  tasks: [dailySummary], // recurring work, see jobs.md
  migrations,
  settings: ticketSettings, // per-server settings, see settings.md
  web: ticketPages, // dashboard pages, see dashboard.md
});
```

Every field except `name` is optional. The name `rupa` is reserved for core's own tables.

## Mounting it

```ts
// src/app/features.ts
import { polls } from '@/features/polls';

export const features: Feature[] = [
  general,
  moderation,
  reminders,
  tickets,
  guilds,
  stats,
  dashboard,
  polls,
];
```

Order matters in three places. Migrations run in this order, component routes are matched in this order, and `/help` lists features in this order.

At startup Rupa refuses to run if two features register the same slash command name, the same component route of the same kind, or the same feature name, or if a feature has two jobs or two tasks with the same name. The error names both features.

## Scaffolding

```bash
npm run rupa -- make feature polls
```

This creates `index.ts`, a `/polls` command, an empty `migrations.ts` and a test. It then prints the two lines to add to `src/app/features.ts`. Rupa does not edit the composition root for you.

## Handler context

Every handler receives a context after its Discord arguments:

| Field          | What it is                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| `ctx.params`   | Values captured from the component's route (empty for commands and events) |
| `ctx.db`       | The shared `better-sqlite3` database                                       |
| `ctx.logger`   | A pino logger tagged with the feature name                                 |
| `ctx.client`   | The discord.js client                                                      |
| `ctx.registry` | Everything mounted, e.g. for a help command                                |
| `ctx.feature`  | The owning feature's name                                                  |
| `ctx.jobs`     | Schedules and cancels jobs, see [jobs.md](./jobs.md)                       |

## Testing a feature

Put pure logic (permission rules, formatting, SQL) in plain functions and test them with Vitest. Repositories can run against `openDatabase(':memory:')` after `migrate(db, [yourFeature])`. See `src/features/moderation/tests` for both kinds.

## The example features

The features in `src/features` are meant to be read, kept or deleted. Two of them need a little setup in Discord:

### Tickets

`/ticket panel` (Manage Server) posts a **Need help?** message with an **Open ticket** button in the current text channel. A member who clicks it describes the problem in a form, and the bot opens a private thread `ticket-0001` with them, mentioning the staff role. One member can have one open ticket per server.

The opener or staff close a ticket with the thread's **Close** button or `/ticket close`, after a confirmation. The thread is locked and archived, so it stays readable as the record, and a summary goes to the log channel. Message content is not copied, because reading it needs the privileged Message Content intent.

- The bot needs **Create Private Threads**, **Send Messages in Threads** and **Manage Threads** in the panel's channel.
- Settings: the staff role (mentioned in new tickets and allowed to close any), the log channel, and **Close idle tickets after (hours)**, which is off at 0. Staff only see a ticket when they are mentioned, so set the staff role.
- Deleting a ticket thread by hand closes its ticket.
