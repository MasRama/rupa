import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { moderationBlocker, type MemberShape } from '../hierarchy';

const member = (id: string, position: number, missing: bigint[] = []): MemberShape => ({
  id,
  roles: { highest: { position } },
  permissions: { has: flag => !missing.includes(flag) },
});

const base = {
  action: 'ban' as const,
  actor: member('mod', 10),
  bot: member('bot', 20),
  ownerId: 'owner',
};

describe('moderationBlocker', () => {
  it('blocks a moderator who no longer has the permission for the action', () => {
    const target = member('user', 5);
    expect(
      moderationBlocker({
        ...base,
        actor: member('mod', 10, [PermissionFlagsBits.BanMembers]),
        targetId: 'user',
        target,
      }),
    ).toBe('You need the Ban Members permission to do that.');
    expect(
      moderationBlocker({
        ...base,
        action: 'kick',
        actor: member('mod', 10, [PermissionFlagsBits.KickMembers]),
        targetId: 'user',
        target,
      }),
    ).toBe('You need the Kick Members permission to do that.');
  });

  it('allows a lower-ranked target', () => {
    expect(moderationBlocker({ ...base, targetId: 'user', target: member('user', 5) })).toBeNull();
  });

  it('allows a target who is not in the server', () => {
    expect(moderationBlocker({ ...base, targetId: 'user', target: null })).toBeNull();
  });

  it('blocks acting on yourself', () => {
    expect(moderationBlocker({ ...base, targetId: 'mod', target: member('mod', 10) })).toMatch(
      /yourself/,
    );
  });

  it('blocks acting on the bot', () => {
    expect(moderationBlocker({ ...base, targetId: 'bot', target: member('bot', 20) })).toMatch(
      /myself/,
    );
  });

  it('blocks acting on the server owner', () => {
    expect(moderationBlocker({ ...base, targetId: 'owner', target: member('owner', 1) })).toMatch(
      /owner/,
    );
  });

  it('blocks a target ranked at or above the moderator', () => {
    expect(moderationBlocker({ ...base, targetId: 'user', target: member('user', 10) })).toMatch(
      /your highest role/,
    );
  });

  it('blocks a target ranked at or above the bot', () => {
    const actor = member('mod', 30);
    expect(
      moderationBlocker({ ...base, actor, targetId: 'user', target: member('user', 25) }),
    ).toMatch(/my highest role/);
  });

  it('lets the server owner act regardless of role position', () => {
    const actor = member('owner', 1);
    expect(
      moderationBlocker({ ...base, actor, targetId: 'user', target: member('user', 5) }),
    ).toBeNull();
  });
});
