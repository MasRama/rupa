import { defineSettings, setting } from '@/core';

export const ticketSettings = defineSettings({
  staffRole: setting.role({
    label: 'Staff role',
    description: 'Mentioned in every new ticket, and allowed to close any ticket.',
  }),
  logChannel: setting.channel({
    label: 'Log channel',
    description: 'A summary of every closed ticket is posted here.',
  }),
  autoCloseHours: setting.number({
    label: 'Close idle tickets after (hours)',
    description: 'Closes a ticket when nobody wrote in it for this long. 0 turns it off.',
    integer: true,
    min: 0,
    max: 720,
    default: 0,
  }),
});
