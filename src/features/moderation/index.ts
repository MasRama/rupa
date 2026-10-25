import { defineFeature } from '@/core';
import { banCommand } from './commands/ban';
import { casesCommand } from './commands/cases';
import { clearCommand } from './commands/clear';
import { kickCommand } from './commands/kick';
import { warnCommand } from './commands/warn';
import { cancelBan, confirmBan } from './components/ban';
import { warnReason } from './components/warn';
import { unban } from './jobs';
import { migrations } from './migrations';
import { moderationSettings } from './settings';

/** Kick, ban (with confirmation, optionally temporary), warn (with a reason modal), clear and case history. */
export const moderation = defineFeature({
  name: 'moderation',
  commands: [kickCommand, banCommand, warnCommand, casesCommand, clearCommand],
  components: [confirmBan, cancelBan, warnReason],
  migrations,
  jobs: [unban],
  settings: moderationSettings,
});
