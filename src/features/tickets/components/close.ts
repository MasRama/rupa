import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { button, confirm, type Guard } from '@/core';
import { wrapUpTicket } from '../closing';
import { canManageTicket } from '../logic';
import { createTicketRepository } from '../repository';
import { ticketSettings } from '../settings';

/**
 * The opener, staff and thread managers may close a ticket. The ticket comes
 * from the route's `ticketId`, or from the thread the command was used in.
 */
export const ticketManager: Guard = (interaction, ctx) => {
  if (!interaction.inCachedGuild()) return 'This only works in a server.';
  const repo = createTicketRepository(ctx.db);
  const ticket = ctx.params.ticketId
    ? repo.get(Number(ctx.params.ticketId))
    : interaction.channelId
      ? repo.findByThread(interaction.channelId)
      : null;
  if (!ticket || ticket.status !== 'open') {
    return ctx.params.ticketId
      ? 'This ticket is already closed.'
      : 'Use this inside an open ticket.';
  }
  const allowed = canManageTicket({
    userId: interaction.user.id,
    openerId: ticket.openerId,
    roleIds: [...interaction.member.roles.cache.keys()],
    staffRoleId: ticketSettings.read(ctx, interaction.guildId).staffRole,
    manageThreads: interaction.memberPermissions.has(PermissionFlagsBits.ManageThreads),
  });
  return allowed ? null : 'Only the person who opened this ticket or staff can close it.';
};

/** Close ticket / Cancel, asked before a ticket is closed. */
export const closeConfirm = confirm('tickets:close-confirm/:ticketId', {
  confirmLabel: 'Close ticket',
  cancelled: 'The ticket stays open.',
  guards: [ticketManager],

  async onConfirm(interaction, ctx) {
    const repo = createTicketRepository(ctx.db);
    const id = Number(ctx.params.ticketId);
    if (!repo.close(id, interaction.user.id)) {
      await interaction.update({ content: 'This ticket is already closed.', components: [] });
      return;
    }
    await interaction.update({ content: 'Ticket closed.', components: [] });
    ctx.logger.info({ ticketId: id, userId: interaction.user.id }, 'Ticket closed');
    await wrapUpTicket(repo.get(id)!, { closedBy: interaction.user.id, reason: null }, ctx);
  },
});

/** The Close button on the ticket's first message. */
export const closeButton = button(
  'tickets:close/:ticketId',
  async (interaction, ctx) => {
    await interaction.reply({
      content: 'Close this ticket?',
      components: [closeConfirm.buttons({ ticketId: ctx.params.ticketId })],
      flags: MessageFlags.Ephemeral,
    });
  },
  { guards: [ticketManager] },
);
