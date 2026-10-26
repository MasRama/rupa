import { EmbedBuilder } from 'discord.js';
import { formatDuration } from '@/core';
import type { Ticket } from './repository';

const HOUR_MS = 60 * 60 * 1000;

/** The opener, members with the staff role, and anyone who can manage threads. */
export function canManageTicket(input: {
  userId: string;
  openerId: string;
  roleIds: readonly string[];
  staffRoleId: string | null;
  manageThreads: boolean;
}): boolean {
  return (
    input.userId === input.openerId ||
    input.manageThreads ||
    (input.staffRoleId !== null && input.roleIds.includes(input.staffRoleId))
  );
}

/** True when nothing happened for `hours`; 0 hours means auto-close is off. */
export function isIdle(lastActivityMs: number, nowMs: number, hours: number): boolean {
  return hours > 0 && nowMs - lastActivityMs >= hours * HOUR_MS;
}

export const threadName = (id: number) => `ticket-${String(id).padStart(4, '0')}`;

/** The record posted to the log channel when a ticket closes. */
export function ticketLogEmbed(input: {
  ticket: Pick<Ticket, 'id' | 'openerId' | 'threadId' | 'subject' | 'createdAt'>;
  closedBy: string | null;
  reason: string | null;
  closedAt: Date;
}): EmbedBuilder {
  const { ticket } = input;
  const embed = new EmbedBuilder()
    .setTitle(`Ticket #${ticket.id} closed`)
    .setColor(0x5865f2)
    .addFields(
      { name: 'Opened by', value: `<@${ticket.openerId}>`, inline: true },
      {
        name: 'Closed by',
        value: input.closedBy ? `<@${input.closedBy}>` : 'Auto-close',
        inline: true,
      },
      {
        name: 'Open for',
        value: formatDuration(input.closedAt.getTime() - Date.parse(ticket.createdAt)),
        inline: true,
      },
      { name: 'Subject', value: ticket.subject },
    )
    .setTimestamp(input.closedAt);
  if (input.reason) embed.addFields({ name: 'Reason', value: input.reason });
  if (ticket.threadId) embed.addFields({ name: 'Thread', value: `<#${ticket.threadId}>` });
  return embed;
}
