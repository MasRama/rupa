# Upgrading

## From 0.1.0 to 0.2.0

0.2.0 is a rewrite. The layered starter (`src/commands`, `src/events`, `src/services`) became a feature-first kit, so there is no in-place upgrade for custom code. Start from a fresh clone and move your commands into features (see [features.md](./features.md)). The changes that affect a running bot are:

**Environment variables**

| 0.1.0                              | 0.2.0                           |
| ---------------------------------- | ------------------------------- |
| `CLIENT_ID`                        | `DISCORD_CLIENT_ID`             |
| `GUILD_ID`                         | `DISCORD_GUILD_ID`              |
| `DATABASE_PATH=./data/bot.sqlite3` | default is now `./data/rupa.db` |

`DISCORD_TOKEN`, `LOG_LEVEL` and `NODE_ENV` are unchanged. New, all optional: `STATS_*` ([stats.md](./stats.md)) and `DASHBOARD_*` / `DISCORD_CLIENT_SECRET` ([dashboard.md](./dashboard.md)).

**Database**

The Knex tables (`users`, `guilds`, `user_guilds`) are not used anymore. Rupa tracks its own migrations in `rupa_migrations`, and the example features create their own tables. Point `DATABASE_PATH` at a new file. The old file can stay as a backup.

**Scripts**

| 0.1.0                            | 0.2.0                                              |
| -------------------------------- | -------------------------------------------------- |
| `npm run deploy-commands`        | `npm run deploy` (shows the plan, then applies it) |
| `npm run remove-guild-commands`  | `npm run rupa -- commands:clear`                   |
| `npm run remove-global-commands` | `npm run rupa -- commands:clear --global`          |
| `npm run remove-all-commands`    | run both of the above                              |
| `npm run migrate`                | `npm run migrate` (now applies feature migrations) |

**Runtime**

Node.js 22.12 or newer is required (0.1.0 allowed 18). `.env` is read by Node itself, so `dotenv` is gone.
