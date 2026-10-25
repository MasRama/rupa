import { PermissionFlagsBits } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cooldown,
  permissionName,
  requireBotPermissions,
  requirePermissions,
  type GuardContext,
} from '../guards';
import { stubInteraction } from './fixtures';

const ctx = (target = '/daily') => ({ target, params: {} }) as unknown as GuardContext;
const as = (options: Parameters<typeof stubInteraction>[2] = {}) =>
  stubInteraction('command', 'daily', options) as never;

describe('cooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('lets the first use through and refuses the next until the time is up', async () => {
    const guard = cooldown('10s');
    expect(await guard(as(), ctx())).toBeNull();

    vi.advanceTimersByTime(4_000);
    const refusal = await guard(as(), ctx());
    expect(refusal).toBe(
      `You can use this again <t:${Date.parse('2026-10-25T12:00:10Z') / 1000}:R>.`,
    );

    vi.advanceTimersByTime(6_000);
    expect(await guard(as(), ctx())).toBeNull();
  });

  it('counts each user separately by default', async () => {
    const guard = cooldown('1m');
    expect(await guard(as({ userId: 'a' }), ctx())).toBeNull();
    expect(await guard(as({ userId: 'b' }), ctx())).toBeNull();
    expect(await guard(as({ userId: 'a' }), ctx())).not.toBeNull();
  });

  it('can share one cooldown across a channel or a server', async () => {
    const perGuild = cooldown('1m', { per: 'guild' });
    expect(await perGuild(as({ userId: 'a' }), ctx())).toBeNull();
    expect(await perGuild(as({ userId: 'b' }), ctx())).not.toBeNull();

    const perChannel = cooldown('1m', { per: 'channel' });
    expect(await perChannel(as({ channelId: 'c1' }), ctx())).toBeNull();
    expect(await perChannel(as({ channelId: 'c2', userId: 'b' }), ctx())).toBeNull();
    expect(await perChannel(as({ channelId: 'c1', userId: 'b' }), ctx())).not.toBeNull();
  });

  it('falls back to the user outside a server', async () => {
    const guard = cooldown('1m', { per: 'guild' });
    expect(await guard(as({ guildId: null, userId: 'a' }), ctx())).toBeNull();
    expect(await guard(as({ guildId: null, userId: 'b' }), ctx())).toBeNull();
  });

  it('keeps commands apart when one guard is shared by a whole feature', async () => {
    const guard = cooldown('1m');
    expect(await guard(as(), ctx('/daily'))).toBeNull();
    expect(await guard(as(), ctx('/weekly'))).toBeNull();
    expect(await guard(as(), ctx('/daily'))).not.toBeNull();
  });

  it('rejects a bad duration when declared', () => {
    expect(() => cooldown('soon')).toThrow('Use a duration like');
  });
});

describe('requirePermissions', () => {
  it('lets members with the permissions through', async () => {
    const guard = requirePermissions(PermissionFlagsBits.BanMembers);
    expect(await guard(as(), ctx())).toBeNull();
  });

  it('names the permissions the member is missing', async () => {
    const one = requirePermissions(PermissionFlagsBits.BanMembers);
    expect(await one(as({ memberPermissions: [] }), ctx())).toBe(
      'You need the Ban Members permission to do that.',
    );

    const two = requirePermissions(
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ModerateMembers,
    );
    expect(await two(as({ memberPermissions: [PermissionFlagsBits.SendMessages] }), ctx())).toBe(
      'You need the Manage Server and Timeout Members permissions to do that.',
    );
  });

  it('refuses outside a server', async () => {
    const guard = requirePermissions(PermissionFlagsBits.BanMembers);
    expect(await guard(as({ memberPermissions: null }), ctx())).toBe(
      'This only works in a server.',
    );
  });
});

describe('requireBotPermissions', () => {
  it("checks the bot's permissions in the channel", async () => {
    const guard = requireBotPermissions(PermissionFlagsBits.KickMembers);
    expect(await guard(as(), ctx())).toBeNull();
    expect(await guard(as({ appPermissions: [] }), ctx())).toBe(
      'I need the Kick Members permission in this channel.',
    );
  });
});

describe('permissionName', () => {
  it('uses the names Discord shows', () => {
    expect(permissionName(PermissionFlagsBits.ManageGuild)).toBe('Manage Server');
    expect(permissionName(PermissionFlagsBits.ModerateMembers)).toBe('Timeout Members');
    expect(permissionName(PermissionFlagsBits.BanMembers)).toBe('Ban Members');
    expect(permissionName(PermissionFlagsBits.ManageMessages)).toBe('Manage Messages');
  });
});
