import { REST, Routes } from 'discord.js';
import { config } from '@/services/config';
import { logger } from '@/services/logger';
import { commands } from '@/commands';

async function deployCommands(): Promise<void> {
  try {
    logger.info('Started deploying application (/) commands...');

    // Construct REST module instance
    const rest = new REST().setToken(config.discordToken);

    // Convert commands to JSON
    const commandsData = commands.map(command => command.data.toJSON());

    logger.info(`Deploying ${commandsData.length} commands...`, {
      commands: commandsData.map(cmd => cmd.name),
    });

    if (config.guildId) {
      // Deploy to specific guild (faster for development)
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commandsData }
      );
      
      logger.info(`Successfully deployed ${commandsData.length} commands to guild ${config.guildId}`);
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commandsData }
      );
      
      logger.info(`Successfully deployed ${commandsData.length} commands globally`);
      logger.warn('Global commands may take up to 1 hour to appear in all servers');
    }

  } catch (error) {
    logger.error('Failed to deploy commands', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  deployCommands()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Command deployment failed', error);
      process.exit(1);
    });
}