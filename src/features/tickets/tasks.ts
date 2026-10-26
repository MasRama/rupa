import { SnowflakeUtil } from 'discord.js';
import { task } from '@/core';
import { wrapUpTicket } from './closing';
import { isIdle } from './logic';
import { createTicketRepository } from './repository';
import { ticketSettings } from './settings';

/** Every hour, closes tickets nobody wrote in for the server's `autoCloseHours`. */
export const closeIdleTickets = task('close-idle', { every: '1h' }, async ctx => {
  const repo = createTicketRepository(ctx.db);
  const now = Date.now();
  for (const ticket of repo.listOpen()) {
    const hours = ticketSettings.read(ctx, ticket.guildId).autoCloseHours;
    if (hours === 0) continue;
    const guild = ctx.client.guilds.cache.get(ticket.guildId);
    if (!guild) continue; // The bot left the server, or is not connected yet.

    const thread = ticket.threadId
      ? await guild.channels.fetch(ticket.threadId).catch(() => null)
      : null;
    if (!thread?.isThread()) {
      // Deleted while the bot was offline.
      repo.close(ticket.id, null);
      continue;
    }
    const lastActivity = thread.lastMessageId
      ? SnowflakeUtil.timestampFrom(thread.lastMessageId)
      : (thread.createdTimestamp ?? now);
    if (!isIdle(lastActivity, now, hours)) continue;

    if (repo.close(ticket.id, null)) {
      ctx.logger.info({ ticketId: ticket.id }, 'Idle ticket closed');
      await wrapUpTicket(
        repo.get(ticket.id)!,
        { closedBy: null, reason: `No activity for ${hours} hours` },
        ctx,
      );
    }
  }
});
