import { Events } from 'discord.js';
import { event } from '@/core';
import { createTicketRepository } from './repository';

/** A ticket thread deleted by hand closes its ticket. */
export const ticketThreadDeleted = event(Events.ThreadDelete, (thread, ctx) => {
  const repo = createTicketRepository(ctx.db);
  const ticket = repo.findByThread(thread.id);
  if (ticket && repo.close(ticket.id, null)) {
    ctx.logger.info({ ticketId: ticket.id }, 'Ticket thread deleted; ticket closed');
  }
});
