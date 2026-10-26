# Interactions and routes

Everything a user can trigger is declared with a helper from `@/core`: `command`, `userCommand` and `messageCommand` ([context-menus.md](./context-menus.md)), `button`, `select` and `modal`, and `event`. Long lists can use `pages` ([pagination.md](./pagination.md)), and risky actions can ask first with `confirm` ([confirmations.md](./confirmations.md)).

## Slash commands

```ts
import { SlashCommandBuilder } from 'discord.js';
import { command } from '@/core';

export const remind = command({
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder')
    .addStringOption(option =>
      option.setName('topic').setDescription('Topic').setAutocomplete(true),
    ),

  async execute(interaction, ctx) {
    await interaction.reply(`Okay: ${interaction.options.getString('topic')}`);
  },

  // Optional: answers autocomplete for any option with setAutocomplete(true)
  async autocomplete(interaction) {
    await interaction.respond([{ name: 'Standup', value: 'standup' }]);
  },
});
```

`data` accepts any `SlashCommandBuilder`, including ones with subcommands. Branch on `interaction.options.getSubcommand()` inside `execute`.

## Components: buttons, select menus, modals

A component's custom id is a **route**. Segments are separated by `/`, and a segment starting with `:` is a param. Start the first segment with the feature name, so routes from different features never collide.

```ts
import { button, modal, select } from '@/core';

export const closeTicket = button('tickets:close/:ticketId', async (interaction, ctx) => {
  ctx.params.ticketId; // string, typed from the route
});

export const pickTopic = select('tickets:topic', async interaction => {
  interaction.values; // works for string, user, role, mentionable and channel selects
});

export const details = modal('tickets:details/:ticketId', async (interaction, ctx) => {
  interaction.fields.getTextInputValue('body');
});
```

Build the id from the same definition, so the route and its params can never drift apart:

```ts
new ButtonBuilder()
  .setCustomId(closeTicket.id({ ticketId: '42' })) // "tickets:close/42"
  .setLabel('Close')
  .setStyle(ButtonStyle.Danger);

new StringSelectMenuBuilder().setCustomId(pickTopic.id()); // a route without params takes no argument
```

Rules:

- Param values are URI-encoded. They may contain `/`, `:` or spaces and still come back intact.
- `id()` throws a `RangeError` if the id would exceed Discord's 100 characters. Keep long data (a reason, a message) in the message, the modal or the database, and put only keys in the route.
- A route matches only ids with the same number of segments. When several routes of the same kind match, the first mounted wins.
- Clicks on components that no route handles anymore (for example, buttons on old messages after a route was renamed) get a short ephemeral notice instead of Discord's "interaction failed".

## Events

```ts
import { Events } from 'discord.js';
import { event } from '@/core';

export const welcome = event(Events.GuildMemberAdd, async (member, ctx) => {
  ctx.logger.info({ userId: member.id }, 'Member joined');
});

export const warmUp = event(Events.ClientReady, (client, ctx) => {}, { once: true });
```

The context always comes last, after the event's own arguments. Remember to declare intents: `GuildMemberAdd` needs `GatewayIntentBits.GuildMembers` in the feature's `intents`, and that intent must also be enabled in the Developer Portal.

## Guards

Commands and components can declare `guards`: checks such as `cooldown('5s')` or `requirePermissions(...)` that run before the handler and refuse the interaction with a private message. See [guards.md](./guards.md).

## Errors

If a handler throws, Rupa logs the error with the feature and target, and answers the user with an ephemeral message. It uses `reply` or `followUp` depending on whether you already replied or deferred. The bot keeps running. Errors in event handlers are logged the same way.
