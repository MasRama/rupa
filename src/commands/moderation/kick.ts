import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits, GuildMember, EmbedBuilder } from 'discord.js';
import { ICommand } from '@/types/bot';
import { logger } from '@/services/logger';

export const kickCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for kicking the user')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    // Check if target user is in the guild
    if (!targetMember) {
      await interaction.reply({
        content: '❌ User is not in this server.',
        ephemeral: true,
      });
      return;
    }

    // Check if user is trying to kick themselves
    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ You cannot kick yourself.',
        ephemeral: true,
      });
      return;
    }

    // Check if user is trying to kick the bot
    if (targetUser.id === interaction.client.user.id) {
      await interaction.reply({
        content: '❌ I cannot kick myself.',
        ephemeral: true,
      });
      return;
    }

    // Check if target user is the server owner
    if (targetUser.id === interaction.guild.ownerId) {
      await interaction.reply({
        content: '❌ You cannot kick the server owner.',
        ephemeral: true,
      });
      return;
    }

    // Check role hierarchy
    if (targetMember.roles.highest.position >= member.roles.highest.position) {
      await interaction.reply({
        content: '❌ You cannot kick a user with equal or higher role than you.',
        ephemeral: true,
      });
      return;
    }

    // Check if bot can kick the target user
    const botMember = interaction.guild.members.me!;
    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
      await interaction.reply({
        content: '❌ I cannot kick a user with equal or higher role than me.',
        ephemeral: true,
      });
      return;
    }

    // Check if target user is kickable
    if (!targetMember.kickable) {
      await interaction.reply({
        content: '❌ I cannot kick this user. They may have higher permissions.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Send DM to the user before kicking (optional)
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🦶 You have been kicked')
          .setColor(0xff9900)
          .addFields(
            { name: 'Server', value: interaction.guild.name, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Moderator', value: interaction.user.username, inline: true }
          )
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        // User has DMs disabled or blocked the bot
        logger.debug('Could not send DM to kicked user', { userId: targetUser.id });
      }

      // Kick the user
      await targetMember.kick(reason);

      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ User Kicked')
        .setColor(0x00ff00)
        .addFields(
          { name: 'User', value: `${targetUser.username} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.username, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed] });

      // Log the action
      logger.logSecurity('User kicked', interaction.user.id, {
        targetUserId: targetUser.id,
        targetUsername: targetUser.username,
        guildId: interaction.guild.id,
        reason,
      });

    } catch (error) {
      logger.error('Error kicking user', error);
      await interaction.reply({
        content: '❌ An error occurred while trying to kick the user.',
        ephemeral: true,
      });
    }
  },
};