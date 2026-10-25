import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it } from 'vitest';
import type { Guard, GuardContext } from '@/core';
import { stubInteraction } from '@/core/routing/tests/fixtures';
import { banCommand } from '../commands/ban';
import { kickCommand } from '../commands/kick';
import { confirmBan } from '../components/ban';

const ctx = { target: '/ban', params: {} } as unknown as GuardContext;

async function refusal(guards: readonly Guard[] | undefined, appPermissions: bigint[]) {
  const interaction = stubInteraction('command', 'ban', { appPermissions }) as never;
  for (const guard of guards ?? []) {
    const message = await guard(interaction, ctx);
    if (message) return message;
  }
  return null;
}

describe('moderation guards', () => {
  it('refuses to ban when the bot cannot ban', async () => {
    for (const guards of [banCommand.guards, confirmBan.guards]) {
      expect(await refusal(guards, [])).toBe('I need the Ban Members permission in this channel.');
      expect(await refusal(guards, [PermissionFlagsBits.BanMembers])).toBeNull();
    }
  });

  it('refuses to kick when the bot cannot kick', async () => {
    expect(await refusal(kickCommand.guards, [])).toBe(
      'I need the Kick Members permission in this channel.',
    );
  });
});
