import { defineFeature } from '@/core';
import { clearConfirm, remindCommand, reminderPages } from './commands/remind';
import { deliver } from './jobs';
import { migrations } from './migrations';

/** /remind: personal reminders, delivered later by a scheduled job. */
export const reminders = defineFeature({
  name: 'reminders',
  commands: [remindCommand],
  components: [reminderPages, clearConfirm],
  migrations,
  jobs: [deliver],
});
