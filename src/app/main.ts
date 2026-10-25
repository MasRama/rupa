import { Events } from 'discord.js';
import { createBot } from '@/core/bot';
import { ConfigError, loadConfig, loadEnvFile, requireDiscordCredentials } from '@/core/config';
import { migrate, openDatabase } from '@/core/database';
import { createJobRunner, createJobScheduler, type JobRunner } from '@/core/jobs';
import { createLogger, flushLogger } from '@/core/logging';
import { createRegistry } from '@/core/routing/registry';
import { coreSchema } from '@/core/schema';
import { createUsageRecorder, scheduleUsagePruning } from '@/core/usage';
import {
  createDiscordAccess,
  createDiscordOAuth,
  createWebApp,
  startWebServer,
  type WebServer,
} from '@/core/web';
import { features } from './features';

async function main(): Promise<void> {
  loadEnvFile();
  const config = loadConfig(process.env);
  const { token, clientId } = requireDiscordCredentials(config);
  const logger = createLogger({
    level: config.logLevel,
    pretty: config.nodeEnv === 'development',
  });

  const registry = createRegistry(features);
  const db = openDatabase(config.databasePath);
  // Tables exist before the first interaction can arrive.
  const { applied } = migrate(db, [coreSchema, ...registry.features]);
  if (applied.length > 0) logger.info({ applied }, 'Applied migrations');

  const { stats } = config;
  const stopPruning = scheduleUsagePruning(db, { retentionDays: stats.retentionDays, logger });
  // The scheduler wakes the runner, which needs the client the bot creates.
  let runner: JobRunner | null = null;
  const jobs = createJobScheduler(db, registry, runAt => runner?.wake(runAt));
  const bot = createBot({
    registry,
    db,
    logger,
    jobs,
    ...(stats.enabled && { usage: createUsageRecorder(db, { trackUsers: stats.trackUsers }) }),
  });
  const jobRunner = createJobRunner({ db, registry, logger, client: bot.client, scheduler: jobs });
  runner = jobRunner;
  // Jobs talk to Discord, so they start once the client is ready.
  bot.client.once(Events.ClientReady, () => {
    jobRunner.start().catch((error: unknown) => {
      logger.error({ err: error }, 'Could not start the job runner');
    });
  });

  let web: WebServer | null = null;
  if (config.dashboard) {
    const { dashboard } = config;
    const app = createWebApp({
      registry,
      db,
      logger,
      client: bot.client,
      config: dashboard,
      oauth: createDiscordOAuth({
        clientId,
        clientSecret: dashboard.clientSecret,
        redirectUri: `${dashboard.url}/auth/callback`,
      }),
      access: createDiscordAccess(bot.client, dashboard.ownerIds),
    });
    web = startWebServer(app, dashboard.port, logger);
  }

  let stopping = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Shutting down');
    stopPruning();
    await web?.close();
    await jobRunner.stop();
    await bot.stop();
    await flushLogger(logger);
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
  try {
    await bot.start(token);
  } catch (error) {
    logger.fatal({ err: error }, 'Could not connect to Discord');
    stopPruning();
    await web?.close();
    await jobRunner.stop();
    await bot.stop();
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exitCode = 1;
});
