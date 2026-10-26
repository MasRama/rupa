import { defineFeature } from '@/core';
import { ticketCommand } from './commands/ticket';
import { closeButton, closeConfirm } from './components/close';
import { openButton, openForm } from './components/open';
import { ticketThreadDeleted } from './events';
import { migrations } from './migrations';
import { ticketSettings } from './settings';
import { closeIdleTickets } from './tasks';

/**
 * Support tickets: `/ticket panel` posts an Open ticket button, each ticket is
 * a private thread with the staff, and closing it posts a summary to the log
 * channel. Idle tickets can close themselves.
 */
export const tickets = defineFeature({
  name: 'tickets',
  commands: [ticketCommand],
  components: [openButton, openForm, closeButton, closeConfirm],
  events: [ticketThreadDeleted],
  tasks: [closeIdleTickets],
  migrations,
  settings: ticketSettings,
});
