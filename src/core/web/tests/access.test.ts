import { PermissionFlagsBits, type Client } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { createDiscordAccess } from '../access';

const member = (manage: boolean) => ({
  permissions: { has: (flag: bigint) => manage && flag === PermissionFlagsBits.ManageGuild },
});

/**
 * A guild whose member cache still says the user can manage it, while Discord
 * says they no longer can. With only the Guilds intent the cache is never updated.
 */
function stubClient() {
  const guild = {
    id: 'guild-1',
    ownerId: 'owner-1',
    members: {
      fetch: async (options: string | { user: string; force?: boolean }) =>
        typeof options === 'object' && options.force ? member(false) : member(true),
    },
  };
  return {
    isReady: () => true,
    application: null,
    guilds: { cache: new Map([[guild.id, guild]]) },
  } as unknown as Client;
}

describe('createDiscordAccess', () => {
  it('lets the server owner manage it', async () => {
    const access = createDiscordAccess(stubClient(), []);
    expect(await access.canManage('owner-1', 'guild-1')).toBe(true);
  });

  it('checks permissions fresh from Discord, not from the member cache', async () => {
    const access = createDiscordAccess(stubClient(), []);
    expect(await access.canManage('user-1', 'guild-1')).toBe(false);
  });

  it('refuses servers the bot is not in', async () => {
    const access = createDiscordAccess(stubClient(), []);
    expect(await access.canManage('owner-1', 'guild-2')).toBe(false);
  });

  it('treats DASHBOARD_OWNER_IDS as owners', async () => {
    const access = createDiscordAccess(stubClient(), ['user-9']);
    expect(await access.isOwner('user-9')).toBe(true);
    expect(await access.isOwner('user-1')).toBe(false);
  });
});
