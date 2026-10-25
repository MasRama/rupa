import { PermissionFlagsBits, type RepliableInteraction } from 'discord.js';
import { parseDuration } from '@/core/time';
import type { HandlerContext } from './definitions';

/** What a guard receives next to the interaction. */
export interface GuardContext extends Omit<HandlerContext, 'params'> {
  /** Route params for components; empty for commands. */
  params: Record<string, string>;
  /** `/command sub` or the component's route pattern, as recorded in usage stats. */
  target: string;
}

/**
 * Runs before a command or component handler. Return a message to refuse the
 * interaction (it is sent to the user privately), or `null` to let it through.
 */
export type Guard = (
  interaction: RepliableInteraction,
  ctx: GuardContext,
) => string | null | Promise<string | null>;

// Where the API name differs from what Discord shows in server settings.
const DISPLAY_NAMES: Record<string, string> = {
  CreateInstantInvite: 'Create Invite',
  ManageGuild: 'Manage Server',
  ModerateMembers: 'Timeout Members',
  SendTTSMessages: 'Send Text-to-Speech Messages',
  ViewChannel: 'View Channels',
  ViewGuildInsights: 'View Server Insights',
};

/** A permission flag as Discord names it, e.g. `ManageGuild` → "Manage Server". */
export function permissionName(flag: bigint): string {
  const key = Object.entries(PermissionFlagsBits).find(([, value]) => value === flag)?.[0];
  if (!key) return `permission ${flag}`;
  return DISPLAY_NAMES[key] ?? key.replace(/(?<=[a-z])(?=[A-Z])/g, ' ');
}

function listPermissions(flags: readonly bigint[]): string {
  const names = flags.map(permissionName);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `the ${list} permission${names.length === 1 ? '' : 's'}`;
}

/**
 * Lets each user (or channel, or server) use the guarded command or component
 * once per `duration`. Kept in memory, so a restart resets it.
 */
export function cooldown(
  duration: string,
  options: { per?: 'user' | 'channel' | 'guild' } = {},
): Guard {
  const ms = parseDuration(duration);
  const per = options.per ?? 'user';
  const until = new Map<string, number>();

  return (interaction, ctx) => {
    const now = Date.now();
    const scope =
      (per === 'guild' && interaction.guildId) ||
      (per === 'channel' && interaction.channelId) ||
      interaction.user.id;
    const key = `${ctx.target}\u0000${per}:${scope}`;

    const blockedUntil = until.get(key);
    if (blockedUntil !== undefined && blockedUntil > now) {
      return `You can use this again <t:${Math.ceil(blockedUntil / 1000)}:R>.`;
    }
    until.set(key, now + ms);
    if (until.size > 10_000) {
      for (const [entry, expires] of until) if (expires <= now) until.delete(entry);
    }
    return null;
  };
}

/** The member must have every permission, in the channel where they used it. */
export function requirePermissions(...permissions: bigint[]): Guard {
  return interaction => {
    const granted = interaction.memberPermissions;
    if (!granted) return 'This only works in a server.';
    const missing = permissions.filter(flag => !granted.has(flag));
    return missing.length === 0 ? null : `You need ${listPermissions(missing)} to do that.`;
  };
}

/** The bot must have every permission in the channel where it was used. */
export function requireBotPermissions(...permissions: bigint[]): Guard {
  return interaction => {
    const missing = permissions.filter(flag => !interaction.appPermissions.has(flag));
    return missing.length === 0 ? null : `I need ${listPermissions(missing)} in this channel.`;
  };
}
