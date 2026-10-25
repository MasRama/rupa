# AGENTS.md

Guidance for coding agents (and humans) working in this repository.

## What this is

Rupa is a feature-first Discord bot kit: discord.js 14, TypeScript (CommonJS), better-sqlite3 with raw SQL, zod for env config, pino for logs, Vitest for tests. Users clone it as a template.

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

## Conventions

- Ephemeral replies: `flags: MessageFlags.Ephemeral` (the `ephemeral` option is deprecated).
- Handlers get `(interaction, ctx)` or `(...eventArgs, ctx)`. Use `ctx.db`, `ctx.logger` and `ctx.params`; do not create database connections or loggers in features.
- Put decision logic in pure functions and test them. Repositories are tested on `openDatabase(':memory:')` after `migrate(db, [feature])`.
- Conventional commits with a real scope (`feat(routing): ...`). They drive release-please, so pick the type carefully.
- Docs in `docs/` change in the same commit as the behavior they describe.

## Gotchas

- `tsconfig.json` uses `module: nodenext` without `"type": "module"`, so the output is CommonJS. Keep it that way; `tsx`, `tsc-alias` and the tests rely on it.
- Discord limits custom ids to 100 characters; `.id()` throws a `RangeError` past that. Keep long data out of routes.
- `npm run deploy` overwrites the whole command list of its scope (guild if `DISCORD_GUILD_ID` is set, otherwise global). Always look at `deploy:plan` first.
