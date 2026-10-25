import { features } from '@/app/features';
import { ConfigError, loadConfig, loadEnvFile } from '@/core/config';
import { createRegistry } from '@/core/routing/registry';
import { clearCommands, deployCommand } from './commands/deploy';
import { jobsCommand } from './commands/jobs';
import { makeFeatureCommand } from './commands/make-feature';
import { migrateCommand, migrateStatusCommand } from './commands/migrate';
import { statsCommand } from './commands/stats';

const HELP = `Usage: npm run rupa -- <command>

Commands:
  make feature <name>     Scaffold src/features/<name>
  migrate                 Apply pending feature migrations
  migrate:status          List applied and pending migrations
  stats [--days 7] [--guild <id>]
                          Show how features, commands and components are used
  jobs                    List scheduled and failed jobs
  deploy [--plan]         Sync slash commands with Discord (--plan: show the diff only)
  commands:clear          Remove every command from Discord

Options:
  --global                Target global commands even when DISCORD_GUILD_ID is set
`;

async function run(argv: string[]): Promise<void> {
  const flags = new Set(argv.filter(arg => arg.startsWith('--')));
  const [command, ...args] = argv.filter(arg => !arg.startsWith('--'));
  const global = flags.has('--global');

  if (command === 'make' && args[0] === 'feature') return makeFeatureCommand(args[1]);
  if (command === 'make:feature') return makeFeatureCommand(args[0]);
  if (!command || command === 'help' || flags.has('--help')) {
    console.log(HELP);
    return;
  }

  loadEnvFile();
  const config = loadConfig(process.env);
  const registry = createRegistry(features);

  switch (command) {
    case 'migrate':
      return migrateCommand(config, registry.features);
    case 'migrate:status':
      return migrateStatusCommand(config, registry.features);
    case 'stats':
      return statsCommand(config, argv);
    case 'jobs':
      return jobsCommand(config);
    case 'deploy':
      return deployCommand(config, registry, { planOnly: flags.has('--plan'), global });
    case 'commands:clear':
      return clearCommands(config, { global });
    default:
      throw new Error(`Unknown command "${command}".\n\n${HELP}`);
  }
}

run(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof ConfigError || error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
