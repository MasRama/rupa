import type { Client } from 'discord.js';
import type { Database, Logger } from '@/core';
import { ticketLogEmbed } from './logic';
import type { Ticket } from './repository';
import { ticketSettings } from './settings';

interface ClosingContext {
  db: Database;
  client: Client;
  logger: Logger;
  feature: string;
}

/**
 * Everything after a ticket is marked closed: a note in the thread, the thread
 * locked and archived, and a summary in the log channel. A missing thread or
 * log channel is skipped, so this is safe to run again.
 */
export async function wrapUpTicket(
  ticket: Ticket,
  closing: { closedBy: string | null; reason: string | null },
  ctx: ClosingContext,
): Promise<void> {
  const guild = ctx.client.guilds.cache.get(ticket.guildId);
  if (!guild) return;

  if (ticket.threadId) {
    try {
      const thread = await guild.channels.fetch(ticket.threadId).catch(() => null);
      if (thread?.isThread()) {
        await thread.send({
          content: closing.closedBy
            ? `Ticket closed by <@${closing.closedBy}>.`
            : `Ticket closed: ${closing.reason?.toLowerCase() ?? 'closed automatically'}.`,
          allowedMentions: { parse: [] },
        });
        await thread.edit({ locked: true, archived: true });
      }
    } catch (error) {
      ctx.logger.warn({ err: error, ticketId: ticket.id }, 'Could not archive the ticket thread');
    }
  }

  const { logChannel } = ticketSettings.read(ctx, ticket.guildId);
  if (!logChannel) return;
  try {
    const channel = await guild.channels.fetch(logChannel);
    if (channel?.isSendable()) {
      await channel.send({
        embeds: [ticketLogEmbed({ ticket, ...closing, closedAt: new Date() })],
      });
    }
  } catch (error) {
    ctx.logger.warn(
      { err: error, ticketId: ticket.id },
      'Could not post to the ticket log channel',
    );
  }
}
