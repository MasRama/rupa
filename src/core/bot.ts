import { Client, Events } from 'discord.js';
import type { Database } from '@/core/database';
import type { Logger } from '@/core/logging';
import type { HandlerContext } from '@/core/routing/definitions';
import type { FeatureRegistry } from '@/core/routing/registry';
import { dispatchInteraction } from '@/core/routing/router';

export interface BotDeps {
  registry: FeatureRegistry;
  db: Database;
  logger: Logger;
}

export interface Bot {
  readonly client: Client;
  /** Logs in; resolves once Discord accepted the token. */
  start(token: string): Promise<void>;
  /** Disconnects from Discord and closes the database. */
  stop(): Promise<void>;
}

/** Wires a discord.js client to the mounted features. Does not connect yet. */
export function createBot({ registry, db, logger }: BotDeps): Bot {
  const client = new Client({ intents: registry.intents() });

  client.once(Events.ClientReady, ready => {
    logger.info(
      { user: ready.user.tag, guilds: ready.guilds.cache.size },
      'Connected to Discord',
    );
  });
  client.on(Events.Error, error => logger.error({ err: error }, 'Discord client error'));
  client.on(Events.Warn, warning => logger.warn({ warning }, 'Discord client warning'));
  client.on(Events.InteractionCreate, interaction =>
    dispatchInteraction(interaction, { registry, db, logger }),
  );

  for (const { feature, definition } of registry.events) {
    const ctx: HandlerContext = {
      params: {},
      db,
      logger: logger.child({ feature }),
      client,
      registry,
      feature,
    };
    const listener = async (...args: unknown[]) => {
      try {
        await (definition.handle as (...all: unknown[]) => unknown)(...args, ctx);
      } catch (error) {
        ctx.logger.error({ err: error, event: definition.name }, 'Event handler failed');
      }
    };
    if (definition.once) client.once(definition.name, listener);
    else client.on(definition.name, listener);
  }

  return {
    client,

    async start(token) {
      await client.login(token);
    },

    async stop() {
      await client.destroy();
      if (db.open) db.close();
    },
  };
}
