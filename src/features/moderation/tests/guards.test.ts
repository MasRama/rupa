import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it } from 'vitest';
import type { Guard, GuardContext } from '@/core';
import { stubInteraction } from '@/core/routing/tests/fixtures';
import { banCommand } from '../commands/ban';
import { kickCommand } from '../commands/kick';
import { banConfirm } from '../components/ban';

const ctx = { target: '/ban', params: {} } as unknown as GuardContext;

async function refusal(
  guards: readonly Guard[] | undefined,
  appPermissions: bigint[],
  params: Record<string, string> = {},
) {
  const interaction = stubInteraction('command', 'ban', { appPermissions }) as never;
  for (const guard of guards ?? []) {
    const message = await guard(interaction, { ...ctx, params });
    if (message) return message;
  }
  return null;
}

describe('moderation guards', () => {
  it('refuses to ban when the bot cannot ban', async () => {
    const yes = { choice: 'yes' };
    expect(await refusal(banCommand.guards, [])).toBe(
      'I need the Ban Members permission in this channel.',
    );
    expect(await refusal(banConfirm.guards, [], yes)).toBe(
      'I need the Ban Members permission in this channel.',
    );
    expect(await refusal(banConfirm.guards, [PermissionFlagsBits.BanMembers], yes)).toBeNull();
  });

  it('still lets a ban be cancelled when the bot cannot ban', async () => {
    expect(banConfirm.route.pattern).toBe('moderation:ban/:userId/:days/:seconds/:choice');
    expect(await refusal(banConfirm.guards, [], { choice: 'no' })).toBeNull();
  });

  it('refuses to kick when the bot cannot kick', async () => {
    expect(await refusal(kickCommand.guards, [])).toBe(
      'I need the Kick Members permission in this channel.',
    );
  });
});
