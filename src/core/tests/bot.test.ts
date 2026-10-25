import { Events, GatewayIntentBits, IntentsBitField } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { createBot } from '@/core/bot';
import { openDatabase } from '@/core/database';
import { defineFeature } from '@/core/feature';
import { command, event } from '@/core/routing/definitions';
import { createRegistry } from '@/core/routing/registry';
import { slash, stubInteraction, stubLogger } from '@/core/routing/tests/fixtures';

const flush = () => new Promise(resolve => setImmediate(resolve));

function build(features: Parameters<typeof createRegistry>[0]) {
  const logger = stubLogger();
  const db = openDatabase(':memory:');
  const bot = createBot({ registry: createRegistry(features), db, logger });
  return { bot, logger, db };
}

describe('createBot', () => {
  it('requests exactly the intents the registry asks for', () => {
    const { bot } = build([
      defineFeature({ name: 'members', intents: [GatewayIntentBits.GuildMembers] }),
    ]);
    const intents = new IntentsBitField(bot.client.options.intents);
    expect(intents.toArray().sort()).toEqual(['GuildMembers', 'Guilds']);
  });

  it('calls feature event handlers with the event args and a context', async () => {
    const handle = vi.fn();
    const { bot, db } = build([
      defineFeature({ name: 'guilds', events: [event(Events.GuildDelete, handle)] }),
    ]);
    const guild = { id: '1' };

    bot.client.emit(Events.GuildDelete, guild as never);
    await flush();

    expect(handle).toHaveBeenCalledWith(guild, expect.objectContaining({ db, feature: 'guilds' }));
  });

  it('logs event handler errors instead of throwing', async () => {
    const { bot, logger } = build([
      defineFeature({
        name: 'guilds',
        events: [
          event(Events.GuildDelete, async () => {
            throw new Error('db down');
          }),
        ],
      }),
    ]);

    bot.client.emit(Events.GuildDelete, { id: '1' } as never);
    await flush();

    expect(logger.error).toHaveBeenCalled();
  });

  it('dispatches interactions to feature commands', async () => {
    const execute = vi.fn();
    const { bot } = build([
      defineFeature({ name: 'general', commands: [command({ data: slash('ping'), execute })] }),
    ]);

    bot.client.emit(Events.InteractionCreate, stubInteraction('command', 'ping'));
    await flush();

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('stop() destroys the client and closes the database', async () => {
    const { bot, db } = build([]);
    await bot.stop();
    expect(db.open).toBe(false);
  });
});
