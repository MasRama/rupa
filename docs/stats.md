# Usage statistics

Rupa records how often each feature, slash command and component is used. The router does it, so features need no code for it.

## What is recorded

One row per handled interaction, written after the handler finishes, or right away when a [guard](./guards.md) refuses it:

| Field      | Example                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| time (UTC) | `2026-10-25T09:14:03.120Z`                                                                    |
| feature    | `moderation`                                                                                  |
| kind       | `command`, `button`, `select` or `modal`                                                      |
| target     | `/ticket admin close`, or a component's route such as `moderation:ban/:userId/:days/:seconds` |
| server id  | `null` in DMs                                                                                 |
| user id    | `null` unless `STATS_TRACK_USERS=true`                                                        |
| outcome    | `ok`, `error` when the handler threw, or `blocked` when a guard refused it                    |
| duration   | how long the handler took, in milliseconds                                                    |

Blocked interactions are counted apart: they are not uses or errors, and they do not affect the average time.

The target is the route pattern, never the raw custom id, so ids and other values inside a custom id are not stored. Autocomplete is not recorded (it fires on every keystroke), and neither are interactions no feature handles.

Recording never affects the reply. If writing the row fails, the error is logged and the user gets the same answer as always.

## Settings

| Variable               | Default |                                                             |
| ---------------------- | ------- | ----------------------------------------------------------- |
| `STATS_ENABLED`        | `true`  | `false` stops recording. Old rows are still pruned.         |
| `STATS_RETENTION_DAYS` | `90`    | Rows older than this are deleted at startup and once a day. |
| `STATS_TRACK_USERS`    | `false` | Store user ids so the stats can count unique people.        |

User ids are personal data. Discord's Developer Policy requires a privacy policy for bots that store them, so leave `STATS_TRACK_USERS` off unless you have one.

## Reading the numbers

**From the terminal** (bot owner, all servers):

```bash
npm run rupa -- stats                 # last 7 days
npm run rupa -- stats --days 30
npm run rupa -- stats --guild 123456789012345678
```

```text
Usage in the last 7 days, all servers

  Uses      41
  Errors    6 (14.6%)
  Avg time  108 ms
  Servers   2
  Users     not tracked
  Blocked   3

  Daily     ▂▃▃▃▄▃█  (2026-10-19 → 2026-10-25)

Top targets
     uses  errors blocked       avg  target
       26       4       0    109 ms  /ban                                   moderation
       14       2       0    109 ms  /ping                                  general
        0       0       3      0 ms  /userinfo                              general
        1       0       0     80 ms  moderation:ban/:userId/:days/:seconds  moderation
```

**In Discord** (server managers, their server): the example `stats` feature adds `/stats`, visible to members with Manage Server. It answers privately with the last 7 or 30 days.

**On the web**: the [dashboard](./dashboard.md) shows the same numbers with a chart, per server and across all servers.

## From your own code

Features can query the data through `@/core`:

```ts
import { createUsageQueries, usageWindow } from '@/core';

const queries = createUsageQueries(ctx.db);
const range = { ...usageWindow(30), guildId: interaction.guildId };

queries.summary(range); // { uses, errors, blocked, avgMs, guilds, users | null }
queries.byTarget(range, 10); // most used first
queries.byFeature(range);
queries.daily(range); // one row per day, idle days included as zero
```

`usageWindow(days)` covers the last `days` calendar days in UTC, today included.
