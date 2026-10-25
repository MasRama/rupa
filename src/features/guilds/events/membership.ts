import { Events } from 'discord.js';
import { event } from '@/core';
import { createGuildRepository } from '../repository';

/** Catches up on guilds joined or renamed while the bot was offline. */
export const syncOnReady = event(
  Events.ClientReady,
  (client, ctx) => {
    const guilds = createGuildRepository(ctx.db);
    for (const guild of client.guilds.cache.values()) guilds.joined(guild.id, guild.name);
    ctx.logger.debug({ count: client.guilds.cache.size }, 'Guild list synced');
  },
  { once: true },
);

export const guildJoined = event(Events.GuildCreate, (guild, ctx) => {
  createGuildRepository(ctx.db).joined(guild.id, guild.name);
  ctx.logger.info({ guildId: guild.id, name: guild.name }, 'Joined guild');
});

export const guildLeft = event(Events.GuildDelete, (guild, ctx) => {
  createGuildRepository(ctx.db).left(guild.id);
  ctx.logger.info({ guildId: guild.id }, 'Left guild');
});
