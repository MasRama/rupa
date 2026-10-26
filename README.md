# Rupa

**A feature-first Discord bot kit for TypeScript.** Build by feature, route every interaction, own your SQLite.

[![CI](https://github.com/MasRama/rupa/actions/workflows/ci.yml/badge.svg)](https://github.com/MasRama/rupa/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Rupa is a starting point for discord.js bots that stay readable as they grow. A capability such as moderation or tickets lives in one folder, with its own slash commands, buttons, modals, events and database tables. It is mounted in a single file.

```ts
// src/features/moderation/components/ban.ts
export const banConfirm = confirm('moderation:ban/:userId/:days/:seconds', {
  confirmLabel: 'Ban',
  async onConfirm(interaction, ctx) {
    const { userId, days } = ctx.params; // typed from the route
    // ...
  },
});

// src/features/moderation/commands/ban.ts
await interaction.reply({
  embeds: [question],
  components: [banConfirm.buttons({ userId: user.id, days: '1', seconds: '0' })],
});

// src/app/features.ts
export const features: Feature[] = [general, moderation, reminders, guilds, stats, dashboard];
```

## Why Rupa

- **Features, not layers.** Code is grouped by what it does. A feature folder holds its commands, components, events, SQL and tests, and it never reaches into another feature's internals.
- **One router for everything.** Slash commands, autocomplete, buttons, select menus, modals and gateway events are all declared the same way.
- **Custom ids as typed routes.** You write `moderation:unban/:userId` once. Rupa builds the id (`unbanButton.id({ userId })`), parses it back into typed `ctx.params`, URI-encodes values and enforces Discord's 100-character limit. Two features claiming the same route fail at startup, not in production.
- **Per-feature SQLite.** It uses `better-sqlite3` with plain SQL and no ORM. Each feature ships ordered migrations, and they run before the bot logs in.
- **Explicit composition.** Nothing is discovered by file location. `src/app/features.ts` lists exactly what runs and in which order.
- **Jobs that survive restarts.** Schedule work for later (`ctx.jobs.schedule(unban, payload, { in: '7d' })`) or on a schedule (`every: '1h'`, or cron with a time zone). It is stored in SQLite and retried with backoff when it fails.
- **Guards before handlers.** Cooldowns and permission checks are declared next to the command, `guards: [cooldown('5s')]`, and refused interactions show up as blocked in the stats.
- **Least privilege by default.** Only the `Guilds` intent is requested. A feature that needs more declares it.
- **Deploys you can read first.** `npm run deploy:plan` shows which slash commands would be added, changed or removed before anything is sent to Discord.
- **Right-click commands and user installs.** `userCommand` and `messageCommand` add Apps menu entries with the same guards, stats and deploy plan as slash commands, and commands can be installed to a user's account to work outside the bot's servers.
- **Pagination that survives restarts.** `pages()` adds ◀ ▶ buttons whose page lives in the route, so every click re-reads the database.
- **Confirmations in one line.** `confirm()` puts Confirm and Cancel buttons on a risky action, checks who answers and lets the question expire.
- **Usage stats built in.** The router records every handled command and component, so `npm run rupa -- stats` and `/stats` show what is actually used, per feature and per server. User ids are only stored if you opt in.
- **Per-server settings.** `defineSettings` gives a feature typed, validated settings that each server sets for itself.
- **An optional dashboard.** Set `DASHBOARD_PORT` and server managers sign in with Discord to see their server's usage and edit settings. It is server-rendered and runs in the bot process.

Rupa follows the same ideas as [Nara](https://github.com/MasRama/nara), the author's feature-first web application kit.

## Quick start

Requirements: Node.js 22.12 or newer, and a Discord application with a bot user. You can create one in the [Developer Portal](https://discord.com/developers/applications).

```bash
git clone https://github.com/MasRama/rupa.git my-bot
cd my-bot
npm install
cp .env.example .env    # fill in DISCORD_TOKEN, DISCORD_CLIENT_ID and a test DISCORD_GUILD_ID
npm run deploy          # register slash commands (instant in the test guild)
npm run dev             # start with reload on save
```

Invite the bot with the `bot` and `applications.commands` scopes, then try `/help` in your test server.

The full walkthrough is in [docs/getting-started.md](./docs/getting-started.md).

## Project layout

```text
src/
├── app/
│   ├── features.ts        # composition root: the mounted features
│   └── main.ts            # config → database → migrations → login
├── core/                  # Rupa itself; features import from "@/core"
├── cli/                   # npm run rupa -- <command>
└── features/
    ├── general/           # /ping /info /help /userinfo /serverinfo, User info menu
    ├── moderation/        # /kick /ban (temporary too) /warn /clear /cases, Warn and Report menus
    ├── reminders/         # /remind, delivered later by a scheduled job
    ├── guilds/            # tracks servers the bot is in (events + SQLite)
    ├── stats/             # /stats for server managers
    └── dashboard/         # web pages, active when DASHBOARD_PORT is set
```

## Commands

| Script                                             | What it does                       |
| -------------------------------------------------- | ---------------------------------- |
| `npm run dev`                                      | Run the bot with reload on save    |
| `npm run build` / `npm start`                      | Compile to `dist/` and run it      |
| `npm run rupa -- make feature <name>`              | Scaffold `src/features/<name>`     |
| `npm run deploy:plan` / `npm run deploy`           | Show / apply slash command changes |
| `npm run migrate` / `npm run migrate:status`       | Apply / list migrations            |
| `npm run rupa -- stats [--days 30] [--guild <id>]` | Show usage statistics              |
| `npm run rupa -- jobs`                             | List scheduled and failed jobs     |
| `npm run check`                                    | Typecheck, lint and test           |

## Documentation

- [Getting started](./docs/getting-started.md)
- [Features](./docs/features.md)
- [Interactions and routes](./docs/interactions.md)
- [Right-click commands and user installs](./docs/context-menus.md)
- [Pagination](./docs/pagination.md)
- [Confirmations](./docs/confirmations.md)
- [Guards and cooldowns](./docs/guards.md)
- [Jobs and tasks](./docs/jobs.md)
- [Database](./docs/database.md)
- [CLI and deploying commands](./docs/cli.md)
- [Usage statistics](./docs/stats.md)
- [Server settings](./docs/settings.md)
- [Dashboard](./docs/dashboard.md)
- [Upgrading from 0.1.0](./docs/upgrading.md)

## Status

Rupa is pre-1.0. The feature API may still change between minor versions, and every change is listed in the [changelog](./CHANGELOG.md). Releases are cut automatically from conventional commits.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) first. Please report security problems privately as described in [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © MasRama
