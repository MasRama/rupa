import { PermissionFlagsBits, Team, type Client, type User } from 'discord.js';
import type { GuildAccess } from './types';

/** Checks permissions live with the bot's client, so revoked access takes effect at once. */
export function createDiscordAccess(client: Client, ownerIds: readonly string[]): GuildAccess {
  let owner: Promise<User | Team | null> | null = null;

  return {
    ready: () => client.isReady(),

    async canManage(userId, guildId) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return false;
      if (guild.ownerId === userId) return true;
      // force: with only the Guilds intent, member updates never reach the cache.
      const member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
      return member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
    },

    async isOwner(userId) {
      if (ownerIds.includes(userId)) return true;
      if (!client.application) return false;
      owner ??= client.application.fetch().then(app => app.owner);
      const resolved = await owner.catch(() => null);
      if (resolved instanceof Team) return resolved.members.has(userId);
      return resolved?.id === userId;
    },
  };
}
