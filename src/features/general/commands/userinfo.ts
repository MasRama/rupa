import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';
import { command, cooldown } from '@/core';
import { userEmbed } from '../user-embed';

export const userinfoCommand = command({
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show information about a user')
    .addUserOption(option => option.setName('user').setDescription('Defaults to you'))
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
    const user = interaction.options.getUser('user') ?? interaction.user;
    // Without the bot in the server (a user install) there is no cached member.
    const member = interaction.inCachedGuild()
      ? (interaction.options.getMember('user') ??
        (user.id === interaction.user.id ? interaction.member : null))
      : null;
    await interaction.reply({ embeds: [userEmbed(user, member)] });
  },
});
