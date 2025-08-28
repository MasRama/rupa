import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, GuildMember, User } from 'discord.js';
import { ICommand } from '@/types/bot';

export const userinfoCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get information about')
        .setRequired(false)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild?.members.cache.get(targetUser.id);

    const embed = new EmbedBuilder()
      .setTitle(`👤 User Information`)
      .setColor(0x5865F2)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: '📝 Basic Info',
          value: [
            `**Username:** ${targetUser.username}`,
            `**Display Name:** ${targetUser.displayName}`,
            `**ID:** ${targetUser.id}`,
            `**Bot:** ${targetUser.bot ? 'Yes' : 'No'}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '📅 Dates',
          value: [
            `**Created:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
            member ? `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>` : '**Joined:** Not in this server',
          ].join('\n'),
          inline: true,
        }
      );

    if (member) {
      // Add server-specific information
      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild?.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .slice(0, 10); // Limit to 10 roles to avoid embed limits

      if (roles.length > 0) {
        embed.addFields({
          name: `🎭 Roles (${member.roles.cache.size - 1})`,
          value: roles.join(', ') + (member.roles.cache.size > 11 ? '...' : ''),
        });
      }

      // Add permissions if user has administrator
      if (member.permissions.has('Administrator')) {
        embed.addFields({
          name: '⚡ Key Permissions',
          value: 'Administrator (All Permissions)',
        });
      } else {
        const keyPermissions = [];
        if (member.permissions.has('ManageGuild')) keyPermissions.push('Manage Server');
        if (member.permissions.has('ManageRoles')) keyPermissions.push('Manage Roles');
        if (member.permissions.has('ManageChannels')) keyPermissions.push('Manage Channels');
        if (member.permissions.has('ModerateMembers')) keyPermissions.push('Moderate Members');
        if (member.permissions.has('KickMembers')) keyPermissions.push('Kick Members');
        if (member.permissions.has('BanMembers')) keyPermissions.push('Ban Members');

        if (keyPermissions.length > 0) {
          embed.addFields({
            name: '⚡ Key Permissions',
            value: keyPermissions.join(', '),
          });
        }
      }

      // Add boost info if applicable
      if (member.premiumSince) {
        embed.addFields({
          name: '💎 Server Booster',
          value: `Since <t:${Math.floor(member.premiumSinceTimestamp! / 1000)}:R>`,
          inline: true,
        });
      }
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

    await interaction.reply({ embeds: [embed] });
  },
};