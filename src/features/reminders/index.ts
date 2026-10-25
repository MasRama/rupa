import { defineFeature } from '@/core';
import { remindCommand } from './commands/remind';
import { deliver } from './jobs';
import { migrations } from './migrations';

/** /remind: personal reminders, delivered later by a scheduled job. */
export const reminders = defineFeature({
  name: 'reminders',
  commands: [remindCommand],
  migrations,
  jobs: [deliver],
});
