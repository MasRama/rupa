import { DiscordBot } from '@/services/DiscordBot';
import { logger } from '@/services/logger';
import { config } from '@/services/config';
import { commands } from '@/commands';

async function main(): Promise<void> {
  try {
    logger.logStartup('Initializing Discord Bot...');
    
    // Log configuration (without sensitive data)
    logger.info('Bot configuration loaded', {
      nodeEnv: config.nodeEnv,
      logLevel: config.logLevel,
      databasePath: config.databasePath,
      commandCount: commands.length,
    });

    // Get bot instance and register commands
    const bot = DiscordBot.getInstance();
    
    // Register all commands
    commands.forEach(command => {
      bot.addCommand(command);
    });

    logger.info(`Registered ${commands.length} commands`, {
      commands: commands.map(cmd => cmd.data.name),
    });

    // Start the bot
    await bot.start();
    
    logger.logStartup('Discord Bot started successfully');

  } catch (error) {
    logger.error('Failed to start Discord Bot', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
main();