import { REST, Routes } from 'discord.js';
import { config } from '@/services/config';
import { logger } from '@/services/logger';

async function removeGuildCommands(): Promise<void> {
  try {
    if (!config.guildId) {
      logger.error('GUILD_ID is not set in the environment variables');
      process.exit(1);
    }

    logger.info(`Started removing guild application (/) commands for guild ${config.guildId}...`);

    // Construct REST module instance
    const rest = new REST().setToken(config.discordToken);

    // Deploy empty array to remove all guild commands
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: [] }
    );
    
    logger.info(`Successfully removed all guild commands from guild ${config.guildId}`);

  } catch (error) {
    logger.error('Failed to remove guild commands', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  removeGuildCommands()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Guild command removal failed', error);
      process.exit(1);
    });
}