import { EmbedBuilder, MessageFlags, type User } from 'discord.js';
import type { CaseAction } from './repository';

export const ephemeral = (content: string) => ({ content, flags: MessageFlags.Ephemeral }) as const;

const ACTION_STYLE: Record<CaseAction, { title: string; color: number }> = {
  warn: { title: 'Member warned', color: 0xfee75c },
  kick: { title: 'Member kicked', color: 0xe67e22 },
  ban: { title: 'Member banned', color: 0xed4245 },
};

/** Public record of a moderation action. */
export function caseEmbed(input: {
  action: CaseAction;
  caseId: number;
  target: User;
  moderator: User;
  reason: string | null;
}): EmbedBuilder {
  const style = ACTION_STYLE[input.action];
  return new EmbedBuilder()
    .setTitle(`${style.title} · case #${input.caseId}`)
    .setColor(style.color)
    .addFields(
      { name: 'Member', value: `${input.target} (${input.target.username})`, inline: true },
      { name: 'Moderator', value: `${input.moderator}`, inline: true },
      { name: 'Reason', value: input.reason ?? 'No reason given' },
    )
    .setTimestamp();
}

/** Tells the member what happened. Returns false when their DMs are closed. */
export async function notifyMember(
  user: User,
  guildName: string,
  action: CaseAction,
  reason: string | null,
): Promise<boolean> {
  const verb = { warn: 'warned in', kick: 'kicked from', ban: 'banned from' }[action];
  try {
    await user.send(`You were ${verb} **${guildName}**.${reason ? `\nReason: ${reason}` : ''}`);
    return true;
  } catch {
    return false;
  }
}
