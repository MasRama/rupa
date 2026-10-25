import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { command } from '@/core';
import { relativeTime } from '../format';

const SHOWN_ROLES = 10;

export const userinfoCommand = command({
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show information about a user')
    .addUserOption(option => option.setName('user').setDescription('Defaults to you')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.inCachedGuild()
      ? (interaction.options.getMember('user') ??
        (user.id === interaction.user.id ? interaction.member : null))
      : null;

    const embed = new EmbedBuilder()
      .setTitle(user.displayName)
      .setColor(member?.displayColor || 0x5865f2)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Username', value: user.username, inline: true },
        { name: 'ID', value: user.id, inline: true },
        { name: 'Account created', value: relativeTime(user.createdTimestamp), inline: true },
      );

    if (member) {
      const roles = member.roles.cache
        .filter(role => role.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => `${role}`);
      embed.addFields(
        {
          name: 'Joined server',
          value: member.joinedTimestamp ? relativeTime(member.joinedTimestamp) : 'Unknown',
          inline: true,
        },
        {
          name: `Roles (${roles.length})`,
          value:
            roles.length === 0
              ? 'None'
              : roles.slice(0, SHOWN_ROLES).join(' ') + (roles.length > SHOWN_ROLES ? ' …' : ''),
        },
      );
      if (member.premiumSinceTimestamp) {
        embed.addFields({
          name: 'Boosting since',
          value: relativeTime(member.premiumSinceTimestamp),
          inline: true,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },
});
