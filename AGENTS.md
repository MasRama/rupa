# AGENTS.md

Guidance for coding agents (and humans) working in this repository.

## What this is

Rupa is a feature-first Discord bot kit: discord.js 14, TypeScript (CommonJS), better-sqlite3 with raw SQL, zod for env config, pino for logs, Hono with server-rendered `hono/jsx` for the optional dashboard, Vitest for tests. Users clone it as a template.

## Commands

```bash
npm run check        # typecheck + lint + format check + tests; must pass before any commit
npm test             # vitest run
npm run build        # tsc + tsc-alias into dist/
npm run rupa -- make feature <name>
npm run deploy:plan  # needs DISCORD_TOKEN / DISCORD_CLIENT_ID in .env
```

## Architecture rules

- `src/core/` is the business-neutral substrate. It never imports from `src/features/` or `src/app/`.
- Features import Rupa only from `@/core` (the public API in `src/core/index.ts`), not from core internals.
- `src/features/<name>/index.ts` is a feature's only public boundary. No deep imports across features.
- `src/app/features.ts` is the only place features are mounted. Nothing is auto-discovered.
- A feature owns its tables (prefixed with the feature name) and their forward-only migrations in `migrations.ts`. Never edit a migration that may have run; add a new one.
- Component custom ids are routes (`<feature>:<action>/:param`) built with `.id()`. Never concatenate custom ids by hand.
- Only `GatewayIntentBits.Guilds` by default. A feature that needs more declares `intents`.
- Core owns the `rupa_*` tables through the reserved migration source `rupa` (`src/core/schema.ts`). Features never touch them directly; use the usage, settings and web APIs from `@/core`.
- Per-server configuration goes through `defineSettings` and the feature's `settings` option, not a feature-made table.
- Right-click commands are `userCommand` / `messageCommand` in the feature's `commands`. A command that is user-installable must work without a cached guild (no `interaction.guild`, no channel access).
- Long lists use `pages()` from `@/core`, not hand-built page buttons or collectors.
- Checks that run before a handler (cooldowns, member or bot permissions) are guards (`guards: [...]` on the command, component or feature), not ad-hoc code at the top of `execute`.
- Delayed or recurring work is a `job` or `task` mounted on the feature and scheduled with `ctx.jobs`, never `setTimeout`. Jobs run at least once, so make them idempotent: reload state by id and check the work is still needed.
- Dashboard pages are added with a feature's `web` hook and guarded with `requireUser`, `requireGuildManager` or `requireOwner`. Never trust ids from a form without checking they belong to that server.

## Conventions

- Ephemeral replies: `flags: MessageFlags.Ephemeral` (the `ephemeral` option is deprecated).
- Handlers get `(interaction, ctx)` or `(...eventArgs, ctx)`. Use `ctx.db`, `ctx.logger` and `ctx.params`; do not create database connections or loggers in features.
- Put decision logic in pure functions and test them. Repositories are tested on `openDatabase(':memory:')` after `migrate(db, [feature])`.
- Conventional commits with a real scope (`feat(routing): ...`). They drive release-please, so pick the type carefully.
- Docs in `docs/` change in the same commit as the behavior they describe.

## Gotchas

- `tsconfig.json` uses `module: nodenext` without `"type": "module"`, so the output is CommonJS. Keep it that way; `tsx`, `tsc-alias` and the tests rely on it.
- Usage stats record the route pattern as the target. Never put personal data in a command or route name, and keep `STATS_TRACK_USERS` off unless the bot has a privacy policy.
- Discord limits custom ids to 100 characters; `.id()` throws a `RangeError` past that. Keep long data out of routes.
- `npm run deploy` overwrites the whole command list of its scope (guild if `DISCORD_GUILD_ID` is set, otherwise global). Always look at `deploy:plan` first.
