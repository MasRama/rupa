import { ICommand } from '@/types/bot';

// Import general commands
import { 
  pingCommand, 
  infoCommand, 
  helpCommand, 
  userinfoCommand, 
  serverinfoCommand 
} from './general';

// Import moderation commands
import { 
  kickCommand, 
  banCommand, 
  clearCommand 
} from './moderation';

// Export all commands as an array
export const commands: ICommand[] = [
  // General commands
  pingCommand,
  infoCommand,
  helpCommand,
  userinfoCommand,
  serverinfoCommand,
  
  // Moderation commands
  kickCommand,
  banCommand,
  clearCommand,
];

// Export individual commands for direct access
export {
  // General
  pingCommand,
  infoCommand,
  helpCommand,
  userinfoCommand,
  serverinfoCommand,
  
  // Moderation
  kickCommand,
  banCommand,
  clearCommand,
};