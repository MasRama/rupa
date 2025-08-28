import { REST, Routes } from 'discord.js';
import { config } from '@/services/config';
import { logger } from '@/services/logger';

async function removeAllCommands(): Promise<void> {
  try {
    logger.info('Started removing all application (/) commands...');

    // Construct REST module instance
    const rest = new REST().setToken(config.discordToken);

    // Remove global commands
    logger.info('Removing global commands...');
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: [] }
    );
    logger.info('✅ Successfully removed all global commands');

    // Remove guild commands if GUILD_ID is set
    if (config.guildId) {
      logger.info(`Removing guild commands for guild ${config.guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: [] }
      );
      logger.info(`✅ Successfully removed all guild commands from guild ${config.guildId}`);
    } else {
      logger.info('⚠️ GUILD_ID not set, skipping guild command removal');
    }

    logger.info('🎉 All commands have been removed successfully!');

  } catch (error) {
    logger.error('Failed to remove commands', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  removeAllCommands()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Command removal failed', error);
      process.exit(1);
    });
}