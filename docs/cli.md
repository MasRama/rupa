# CLI and deploying commands

Rupa's CLI runs through npm: `npm run rupa -- <command>`. The common commands also have their own scripts.

| Command                           | Script                   | Needs Discord credentials |
| --------------------------------- | ------------------------ | ------------------------- |
| `make feature <name>`             |                          | no                        |
| `migrate`                         | `npm run migrate`        | no                        |
| `migrate:status`                  | `npm run migrate:status` | no                        |
| `stats [--days N] [--guild <id>]` |                          | no                        |
| `deploy --plan`                   | `npm run deploy:plan`    | yes                       |
| `deploy`                          | `npm run deploy`         | yes                       |
| `commands:clear`                  |                          | yes                       |

The CLI reads `.env` the same way the bot does. `migrate` applies core's own tables first, then each feature's. `stats` is described in [stats.md](./stats.md).

## Deploying slash commands

Slash commands have to be registered with Discord before users can see them. The bot does not do this on start, so restarting never touches your command list by accident.

```bash
npm run deploy:plan
```

```text
Command plan for guild 123456789012345678:
  + /tickets
  ~ /ban
  - /oldcommand
  8 unchanged
```

The plan compares your commands with what Discord currently has. It ignores fields Discord fills in itself, so an unchanged command shows as unchanged. `npm run deploy` prints the same plan and then applies it in one bulk overwrite. If nothing changed, it sends nothing.

**Scope.** When `DISCORD_GUILD_ID` is set, commands go to that server only and appear instantly. That is ideal for development. Pass `--global` (`npm run deploy -- --global`), or unset `DISCORD_GUILD_ID`, to deploy globally for production.

If you once deployed globally and then switch to guild deploys, users see both copies. Clear one scope with:

```bash
npm run rupa -- commands:clear            # the guild in DISCORD_GUILD_ID
npm run rupa -- commands:clear --global   # global commands
```

## After `npm run build`

The compiled CLI works without dev dependencies:

```bash
node dist/cli/index.js deploy
node dist/cli/index.js migrate:status
```
