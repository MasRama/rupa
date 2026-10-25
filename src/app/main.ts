import { createBot } from '@/core/bot';
import {
  ConfigError,
  loadConfig,
  loadEnvFile,
  requireDiscordCredentials,
} from '@/core/config';
import { migrate, openDatabase } from '@/core/database';
import { createLogger } from '@/core/logging';
import { createRegistry } from '@/core/routing/registry';
import { features } from './features';

async function main(): Promise<void> {
  loadEnvFile();
  const config = loadConfig(process.env);
  const { token } = requireDiscordCredentials(config);
  const logger = createLogger({
    level: config.logLevel,
    pretty: config.nodeEnv === 'development',
  });

  const registry = createRegistry(features);
  const db = openDatabase(config.databasePath);
  // Tables exist before the first interaction can arrive.
  const { applied } = migrate(db, registry.features);
  if (applied.length > 0) logger.info({ applied }, 'Applied migrations');

  const bot = createBot({ registry, db, logger });

  let stopping = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Shutting down');
    await bot.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.on('unhandledRejection', reason => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });

  logger.info(
    { features: registry.features.map(feature => feature.name), commands: registry.commands.size },
    'Starting Rupa',
  );
  await bot.start(token);
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exitCode = 1;
});
