# Right-click commands and user installs

## Right-click commands

Discord calls them context menu commands. They appear under **Apps** when someone right-clicks a user or a message. Declare them with `userCommand` or `messageCommand` and list them in the feature's `commands`, next to its slash commands:

```ts
import { ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags } from 'discord.js';
import { cooldown, messageCommand, userCommand } from '@/core';

export const userInfoMenu = userCommand({
  data: new ContextMenuCommandBuilder().setName('User info').setType(ApplicationCommandType.User),
  guards: [cooldown('5s')],
  async execute(interaction, ctx) {
    interaction.targetUser; // who was right-clicked
    interaction.targetMember; // their member object, in a server the bot is in
  },
});

export const reportMenu = messageCommand({
  data: new ContextMenuCommandBuilder()
    .setName('Report message')
    .setType(ApplicationCommandType.Message),
  async execute(interaction, ctx) {
    interaction.targetMessage; // the message that was right-clicked
  },
});

export const general = defineFeature({ name: 'general', commands: [pingCommand, userInfoMenu] });
```

They work like slash commands: feature and command [guards](./guards.md) run first, errors get the usual reply, they are recorded in the [stats](./stats.md) as `User info (user menu)` or `Report message (message menu)`, and `npm run deploy` registers them. `/help` lists them under "Right-click menus".

Things Discord does differently:

- The name is what people see in the menu, so it may contain capitals and spaces (`Report message`). It can be up to 32 characters.
- There is no description and there are no options. Ask for more input with a [modal](./interactions.md), as the moderation feature's **Warn** does.
- A bot can have at most 5 user commands and 5 message commands. Rupa refuses to start with more.
- A right-click command may share its name with a slash command or with a menu of the other type. `/info`, **info** on a user and **info** on a message are three separate commands.

The example features ship three: **User info** (general), **Warn** and **Report message** (moderation).

## User installs

A Discord app can be installed to a server, or to a user's own account. A user install lets someone use the bot's commands anywhere they are, including servers the bot is not in, DMs and group DMs. Choose per command with discord.js:

```ts
new SlashCommandBuilder()
  .setName('remind')
  // ...
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  )
  .setContexts(
    InteractionContextType.Guild, // servers
    InteractionContextType.BotDM, // DMs with the bot
    InteractionContextType.PrivateChannel, // other DMs and group DMs
  );
```

Enable **User Install** under Installation in the Developer Portal as well. `npm run deploy:plan` shows a command as changed when its install types or contexts change.

When a command comes from a user install in a server the bot is not in, the interaction has a `guildId` but no guild: `interaction.inCachedGuild()` is false, `interaction.guild` is null, and the bot cannot read or post in that channel. Write such commands so they still work:

- Reply to the interaction. That always works, including ephemeral replies.
- Do not depend on the guild, its members or its channels. **User info** shows the account without server details in that case.
- Deliver later messages by DM. Reminders try the original channel and fall back to a DM.
- Leave guild-only features, such as moderation, as server installs with the `Guild` context.
- `requireBotPermissions` refuses there with "Add me to this server to use this here." when the bot lacks a permission.

`/userinfo`, **User info** and `/remind` are user-installable in the example features.
