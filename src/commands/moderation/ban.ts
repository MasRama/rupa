import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits, GuildMember, EmbedBuilder } from 'discord.js';
import { ICommand } from '@/types/bot';
import { logger } from '@/services/logger';

export const banCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for banning the user')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Number of days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

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
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    // Check if user is trying to ban themselves
    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ You cannot ban yourself.',
        ephemeral: true,
      });
      return;
    }

    // Check if user is trying to ban the bot
    if (targetUser.id === interaction.client.user.id) {
      await interaction.reply({
        content: '❌ I cannot ban myself.',
        ephemeral: true,
      });
      return;
    }

    // Check if target user is the server owner
    if (targetUser.id === interaction.guild.ownerId) {
      await interaction.reply({
        content: '❌ You cannot ban the server owner.',
        ephemeral: true,
      });
      return;
    }

    // If the user is in the guild, check role hierarchy
    if (targetMember) {
      if (targetMember.roles.highest.position >= member.roles.highest.position) {
        await interaction.reply({
          content: '❌ You cannot ban a user with equal or higher role than you.',
          ephemeral: true,
        });
        return;
      }

      // Check if bot can ban the target user
      const botMember = interaction.guild.members.me!;
      if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        await interaction.reply({
          content: '❌ I cannot ban a user with equal or higher role than me.',
          ephemeral: true,
        });
        return;
      }

      // Check if target user is bannable
      if (!targetMember.bannable) {
        await interaction.reply({
          content: '❌ I cannot ban this user. They may have higher permissions.',
          ephemeral: true,
        });
        return;
      }
    }

    // Check if user is already banned
    try {
      const existingBan = await interaction.guild.bans.fetch(targetUser.id);
      if (existingBan) {
        await interaction.reply({
          content: '❌ This user is already banned.',
          ephemeral: true,
        });
        return;
      }
    } catch (error) {
      // User is not banned, continue
    }

    try {
      // Send DM to the user before banning (if they're in the server)
      if (targetMember) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setTitle('🔨 You have been banned')
            .setColor(0xff0000)
            .addFields(
              { name: 'Server', value: interaction.guild.name, inline: true },
              { name: 'Reason', value: reason, inline: true },
              { name: 'Moderator', value: interaction.user.username, inline: true }
            )
            .setTimestamp();

          await targetUser.send({ embeds: [dmEmbed] });
        } catch (error) {
          // User has DMs disabled or blocked the bot
          logger.debug('Could not send DM to banned user', { userId: targetUser.id });
        }
      }

      // Ban the user
      await interaction.guild.bans.create(targetUser.id, {
        reason: `${reason} | Moderator: ${interaction.user.username}`,
        deleteMessageSeconds: deleteDays * 24 * 60 * 60, // Convert days to seconds
      });

      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ User Banned')
        .setColor(0xff0000)
        .addFields(
          { name: 'User', value: `${targetUser.username} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.username, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      if (deleteDays > 0) {
        successEmbed.addFields({
          name: 'Messages Deleted',
          value: `${deleteDays} day${deleteDays === 1 ? '' : 's'} worth of messages`,
          inline: true,
        });
      }

      await interaction.reply({ embeds: [successEmbed] });

      // Log the action
      logger.logSecurity('User banned', interaction.user.id, {
        targetUserId: targetUser.id,
        targetUsername: targetUser.username,
        guildId: interaction.guild.id,
        reason,
        deleteDays,
      });

    } catch (error) {
      logger.error('Error banning user', error);
      await interaction.reply({
        content: '❌ An error occurred while trying to ban the user.',
        ephemeral: true,
      });
    }
  },
};