import { PermissionFlagsBits } from 'discord.js';

/** The parts of a GuildMember the hierarchy rules look at. */
export interface MemberShape {
  id: string;
  roles: { highest: { position: number } };
  permissions: { has(permission: bigint): boolean };
}

export interface ModerationCheck {
  action: 'warn' | 'kick' | 'ban';
  actor: MemberShape;
  bot: MemberShape;
  ownerId: string;
  targetId: string;
  /** null when the target is not a member of the server (allowed for bans). */
  target: MemberShape | null;
}

const PAST_TENSE = { warn: 'warned', kick: 'kicked', ban: 'banned' } as const;

const REQUIRED = {
  warn: { flag: PermissionFlagsBits.ModerateMembers, name: 'Timeout Members' },
  kick: { flag: PermissionFlagsBits.KickMembers, name: 'Kick Members' },
  ban: { flag: PermissionFlagsBits.BanMembers, name: 'Ban Members' },
} as const;

/** Returns why the action is not allowed, or null when it is. */
export function moderationBlocker(check: ModerationCheck): string | null {
  const { action, actor, bot, ownerId, targetId, target } = check;

  // Command permissions are checked by Discord, but a button can be pressed
  // after the moderator lost the permission.
  const required = REQUIRED[action];
  if (!actor.permissions.has(required.flag)) {
    return `You need the ${required.name} permission to do that.`;
  }

  if (targetId === actor.id) return `You cannot ${action} yourself.`;
  if (targetId === bot.id) return `I cannot ${action} myself.`;
  if (targetId === ownerId) return `The server owner cannot be ${PAST_TENSE[action]}.`;
  if (!target) return null;

  if (actor.id !== ownerId && target.roles.highest.position >= actor.roles.highest.position) {
    return 'That member has a role equal to or above your highest role.';
  }
  if (action !== 'warn' && target.roles.highest.position >= bot.roles.highest.position) {
    return 'That member has a role equal to or above my highest role.';
  }
  return null;
}
