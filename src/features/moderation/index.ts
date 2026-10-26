import { defineFeature } from '@/core';
import { banCommand } from './commands/ban';
import { casePages, casesCommand } from './commands/cases';
import { clearCommand } from './commands/clear';
import { kickCommand } from './commands/kick';
import { reportMenu } from './commands/report';
import { warnCommand, warnMenu } from './commands/warn';
import { banConfirm } from './components/ban';
import { warnReason } from './components/warn';
import { unban } from './jobs';
import { migrations } from './migrations';
import { moderationSettings } from './settings';

/**
 * Kick, ban (with confirmation, optionally temporary), warn (with a reason modal,
 * also from a right-click), clear, paginated case history and message reports.
 */
export const moderation = defineFeature({
  name: 'moderation',
  commands: [
    kickCommand,
    banCommand,
    warnCommand,
    casesCommand,
    clearCommand,
    warnMenu,
    reportMenu,
  ],
  components: [banConfirm, warnReason, casePages],
  migrations,
  jobs: [unban],
  settings: moderationSettings,
});
