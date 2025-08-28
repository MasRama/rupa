import { REST, Routes } from 'discord.js';
import { config } from '@/services/config';
import { logger } from '@/services/logger';

async function removeGlobalCommands(): Promise<void> {
  try {
    logger.info('Started removing global application (/) commands...');

    // Construct REST module instance
    const rest = new REST().setToken(config.discordToken);

    // Deploy empty array to remove all global commands
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: [] }
    );
    
    logger.info('Successfully removed all global commands');

  } catch (error) {
    logger.error('Failed to remove global commands', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  removeGlobalCommands()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Global command removal failed', error);
      process.exit(1);
    });
}