# Guards

A guard is a check that runs before a command or component handler. It either lets the interaction through or refuses it with a message, which the user sees privately. Guards keep checks such as cooldowns and permissions out of your handlers.

```ts
import { PermissionFlagsBits } from 'discord.js';
import { command, cooldown, requireBotPermissions } from '@/core';

export const kickCommand = command({
  data: new SlashCommandBuilder().setName('kick') /* ... */,
  guards: [requireBotPermissions(PermissionFlagsBits.KickMembers), cooldown('3s')],
  async execute(interaction, ctx) {
    // only runs when every guard said yes
  },
});
```

Components take guards as a third argument:

```ts
export const confirmBan = button('moderation:ban/:userId', handler, {
  guards: [requireBotPermissions(PermissionFlagsBits.BanMembers)],
});
```

Guards run in order, and the first refusal wins. They do not run for autocomplete.

## Built-in guards

| Guard                                | Refuses when                                                      |
| ------------------------------------ | ----------------------------------------------------------------- |
| `cooldown('5s')`                     | the same user used this command or component less than 5 s ago    |
| `cooldown('1m', { per: 'channel' })` | anyone used it in this channel in the last minute (`'guild'` too) |
| `requirePermissions(flag, ...)`      | the member lacks a permission in this channel, or it is a DM      |
| `requireBotPermissions(flag, ...)`   | the bot lacks a permission in this channel                        |

The refusal messages name permissions the way Discord's server settings do, for example "I need the Ban Members permission in this channel."

`cooldown` counts per command: `/userinfo` and `/serverinfo` with the same guard have separate cooldowns. The cooldown lives in memory, so restarting the bot resets it. That is fine for spam protection. For a limit that must hold across restarts (one daily reward per user), store the time in your feature's table.

`requirePermissions` checks the member at the moment they use it. Pair it with `setDefaultMemberPermissions` on the command, which hides the command from members who lack the permission in the first place; server admins can change that in Integrations, the guard cannot be changed.

## Guards for the whole feature

```ts
export const admin = defineFeature({
  name: 'admin',
  guards: [requirePermissions(PermissionFlagsBits.ManageGuild)],
  commands: [/* ... */],
  components: [/* ... */],
});
```

A feature's guards run before each of its commands and components, ahead of their own guards. They do not apply to events.

## Writing a guard

A guard is a function that returns a message to refuse, or `null` to let the interaction through. It may be async.

```ts
import type { Guard } from '@/core';

export const onlyInTicketChannels: Guard = (interaction, ctx) => {
  const ticket = createTicketRepository(ctx.db).findByChannel(interaction.channelId ?? '');
  return ticket ? null : 'Use this inside a ticket channel.';
};
```

The context is the handler context plus `ctx.target` (the command name or route pattern) and `ctx.params` (the route's params, for components). A guard that throws is treated like a handler that threw: the error is logged and the user gets the usual error message.

## In usage stats

A refused interaction is recorded with the outcome `blocked`. It does not count as a use or an error, and `npm run rupa -- stats`, `/stats` and the dashboard show blocked counts separately. A command that is blocked often may have a cooldown that is too long. See [stats.md](./stats.md).
