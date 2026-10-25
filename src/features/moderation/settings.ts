import { defineSettings, setting } from '@/core';

export const moderationSettings = defineSettings({
  logChannel: setting.channel({
    label: 'Log channel',
    description: 'Every warn, kick and ban is also posted here.',
  }),
  dmMembers: setting.boolean({
    label: 'DM members about actions',
    description: 'Tell members by direct message when they are warned, kicked or banned.',
    default: true,
  }),
});
