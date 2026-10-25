import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  MessageFlags,
} from 'discord.js';
import { cooldown, userCommand } from '@/core';
import { userEmbed } from '../user-embed';

/** Right-click a user → Apps → User info. */
export const userInfoMenu = userCommand({
  data: new ContextMenuCommandBuilder()
    .setName('User info')
    .setType(ApplicationCommandType.User)
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ),

  guards: [cooldown('5s')],

  async execute(interaction) {
    const member = interaction.inCachedGuild() ? interaction.targetMember : null;
    await interaction.reply({
      embeds: [userEmbed(interaction.targetUser, member)],
      flags: MessageFlags.Ephemeral,
    });
  },
});
