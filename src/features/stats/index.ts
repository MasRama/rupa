import { defineFeature } from '@/core';
import { statsCommand } from './commands/stats';

/** `/stats`: usage of the bot's features in the current server, for its managers. */
export const stats = defineFeature({
  name: 'stats',
  commands: [statsCommand],
});
