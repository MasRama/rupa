import { Client } from 'discord.js';
import { logger } from '@/services/logger';

export async function handleReady(client: Client<true>): Promise<void> {
  logger.logStartup(`🤖 ${client.user.tag} is now online!`);
  
  // Log bot statistics
  const guildCount = client.guilds.cache.size;
  const userCount = client.users.cache.size;
  
  logger.info('Bot statistics', {
    guilds: guildCount,
    users: userCount,
    ping: client.ws.ping,
    uptime: client.uptime,
  });

  // Set bot activity/presence
  try {
    await client.user.setActivity({
      name: `${guildCount} servers | /help`,
      type: 3, // WATCHING
    });
    
    logger.info('Bot presence set successfully');
  } catch (error) {
    logger.error('Failed to set bot presence', error);
  }

  // Additional initialization tasks can be added here
  logger.logStartup('Bot initialization completed');
}