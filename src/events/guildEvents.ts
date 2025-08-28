import { Events, Guild } from 'discord.js';
import { logger } from '@/services/logger';
import { DatabaseService } from '@/services/database/DatabaseService';

export async function handleGuildCreate(guild: Guild): Promise<void> {
  logger.logEvent('Bot added to guild', {
    guildId: guild.id,
    guildName: guild.name,
    memberCount: guild.memberCount,
    ownerId: guild.ownerId,
  });

  try {
    const db = DatabaseService.getInstance();
    await db.createOrUpdateGuild(guild.id, guild.name, {
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      joinedAt: new Date().toISOString(),
    });
    
    logger.logDatabase('upsert', 'guilds', guild.id);
    
    // Send welcome message to the system channel if available
    if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.members.me!)?.has('SendMessages')) {
      await guild.systemChannel.send({
        embeds: [{
          title: '👋 Hello!',
          description: 'Thanks for adding me to your server! Use `/help` to see available commands.',
          color: 0x5865F2,
          timestamp: new Date().toISOString(),
        }]
      });
    }
  } catch (error) {
    logger.error('Error handling guild create event', error);
  }
}

export async function handleGuildDelete(guild: Guild): Promise<void> {
  logger.logEvent('Bot removed from guild', {
    guildId: guild.id,
    guildName: guild.name,
  });

  // Note: We don't delete guild data immediately in case the bot is re-added
  // Data cleanup can be handled separately with a scheduled job
}