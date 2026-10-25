import { defineFeature } from '@/core';
import { helpCommand } from './commands/help';
import { infoCommand } from './commands/info';
import { pingCommand } from './commands/ping';
import { serverinfoCommand } from './commands/serverinfo';
import { userinfoCommand } from './commands/userinfo';

/** Everyday commands every bot needs. */
export const general = defineFeature({
  name: 'general',
  commands: [pingCommand, infoCommand, helpCommand, userinfoCommand, serverinfoCommand],
});
