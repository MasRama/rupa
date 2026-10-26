import type { Feature } from '@/core';
import { dashboard } from '@/features/dashboard';
import { general } from '@/features/general';
import { guilds } from '@/features/guilds';
import { moderation } from '@/features/moderation';
import { reminders } from '@/features/reminders';
import { roles } from '@/features/roles';
import { stats } from '@/features/stats';
import { tickets } from '@/features/tickets';

/**
 * The bot's composition root: every mounted feature, in order. A feature is
 * active only when it is listed here. Component routes are matched in this
 * order, and migrations run in this order.
 */
export const features: Feature[] = [
  general,
  moderation,
  reminders,
  tickets,
  roles,
  guilds,
  stats,
  dashboard,
];
