import type { Feature } from '@/core';

/**
 * The bot's composition root: every mounted feature, in order. A feature is
 * active only when it is listed here. Component routes are matched in this
 * order, and migrations run in this order.
 */
export const features: Feature[] = [];
