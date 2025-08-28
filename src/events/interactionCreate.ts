import { Interaction } from 'discord.js';
import { logger } from '@/services/logger';
import { DiscordBot } from '@/services/DiscordBot';

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // Handle chat input commands (slash commands)
  if (interaction.isChatInputCommand()) {
    const bot = DiscordBot.getInstance();
    const command = bot.getCommand(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command attempted: ${interaction.commandName}`, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
      
      await interaction.reply({
        content: '❌ Unknown command. Please use `/help` to see available commands.',
        ephemeral: true,
      });
      return;
    }

    try {
      logger.logCommand(
        interaction.commandName,
        interaction.user.id,
        interaction.guildId || undefined
      );

      // Execute the command
      await command.execute(interaction);
      
      logger.debug(`Command executed successfully: ${interaction.commandName}`);
    } catch (error) {
      logger.error(`Error executing command: ${interaction.commandName}`, error);

      const errorMessage = '❌ There was an error while executing this command!';
      
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ 
            content: errorMessage, 
            ephemeral: true 
          });
        } else {
          await interaction.reply({ 
            content: errorMessage, 
            ephemeral: true 
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error message to user', replyError);
      }
    }
  }

  // Handle button interactions
  if (interaction.isButton()) {
    logger.logEvent('Button interaction', {
      customId: interaction.customId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    // Add button interaction handling logic here
    // This is where you would handle custom button interactions
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    logger.logEvent('Select menu interaction', {
      customId: interaction.customId,
      values: interaction.values,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    // Add select menu interaction handling logic here
  }

  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    logger.logEvent('Modal submission', {
      customId: interaction.customId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    // Add modal submission handling logic here
  }
}