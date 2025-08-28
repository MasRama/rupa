import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits, TextChannel, EmbedBuilder } from 'discord.js';
import { ICommand } from '@/types/bot';
import { logger } from '@/services/logger';

export const clearCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete multiple messages at once')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user');
    const channel = interaction.channel as TextChannel;

    // Check if the channel is a text channel
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: '❌ This command can only be used in text channels.',
        ephemeral: true,
      });
      return;
    }

    // Check bot permissions
    const botPermissions = channel.permissionsFor(interaction.client.user.id);
    if (!botPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: '❌ I need the "Manage Messages" permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Defer the reply as this might take some time
      await interaction.deferReply({ ephemeral: true });

      let messages;
      
      if (targetUser) {
        // Fetch more messages to filter by user
        const fetchedMessages = await channel.messages.fetch({ limit: 100 });
        messages = fetchedMessages.filter(msg => msg.author.id === targetUser.id).first(amount);
      } else {
        // Fetch the specified amount of messages
        messages = await channel.messages.fetch({ limit: amount });
      }

      if (messages.size === 0) {
        await interaction.editReply({
          content: '❌ No messages found to delete.',
        });
        return;
      }

      // Filter out messages older than 14 days (Discord limitation)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recentMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
      const oldMessages = messages.size - recentMessages.size;

      if (recentMessages.size === 0) {
        await interaction.editReply({
          content: '❌ All selected messages are older than 14 days and cannot be bulk deleted.',
        });
        return;
      }

      // Delete messages
      let deletedCount = 0;
      
      if (recentMessages.size === 1) {
        // Single message deletion
        await recentMessages.first()?.delete();
        deletedCount = 1;
      } else {
        // Bulk delete
        const deleted = await channel.bulkDelete(recentMessages, true);
        deletedCount = deleted.size;
      }

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('✅ Messages Cleared')
        .setColor(0x00ff00)
        .addFields(
          { name: 'Messages Deleted', value: deletedCount.toString(), inline: true },
          { name: 'Channel', value: channel.toString(), inline: true },
          { name: 'Moderator', value: interaction.user.username, inline: true }
        )
        .setTimestamp();

      if (targetUser) {
        embed.addFields({
          name: 'Target User',
          value: `${targetUser.username} (${targetUser.id})`,
          inline: true,
        });
      }

      if (oldMessages > 0) {
        embed.addFields({
          name: '⚠️ Note',
          value: `${oldMessages} message${oldMessages === 1 ? '' : 's'} older than 14 days could not be deleted.`,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });

      // Log the action
      logger.logSecurity('Messages cleared', interaction.user.id, {
        channelId: channel.id,
        deletedCount,
        targetUserId: targetUser?.id,
        guildId: interaction.guild.id,
        oldMessagesSkipped: oldMessages,
      });

    } catch (error) {
      logger.error('Error clearing messages', error);
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while trying to delete messages.',
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while trying to delete messages.',
          ephemeral: true,
        });
      }
    }
  },
};