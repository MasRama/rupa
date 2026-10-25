import type { Feature } from '@/core';
import { general } from '@/features/general';
import { guilds } from '@/features/guilds';
import { moderation } from '@/features/moderation';
import { stats } from '@/features/stats';

/**
 * The bot's composition root: every mounted feature, in order. A feature is
 * active only when it is listed here. Component routes are matched in this
 * order, and migrations run in this order.
 */
export const features: Feature[] = [general, moderation, guilds, stats];
