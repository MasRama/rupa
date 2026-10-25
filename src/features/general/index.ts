import { defineFeature } from '@/core';
import { helpCommand } from './commands/help';
import { infoCommand } from './commands/info';
import { pingCommand } from './commands/ping';
import { serverinfoCommand } from './commands/serverinfo';
import { userInfoMenu } from './commands/user-info-menu';
import { userinfoCommand } from './commands/userinfo';

/** Everyday commands every bot needs, and a User info right-click menu. */
export const general = defineFeature({
  name: 'general',
  commands: [
    pingCommand,
    infoCommand,
    helpCommand,
    userinfoCommand,
    serverinfoCommand,
    userInfoMenu,
  ],
});
