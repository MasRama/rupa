import { MessageFlags } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { openDatabase } from '@/core/database';
import { defineFeature } from '@/core/feature';
import { button, command, modal, select } from '../definitions';
import { createRegistry } from '../registry';
import { dispatchInteraction } from '../router';
import { slash, stubInteraction, stubLogger } from './fixtures';

function setup(feature: ReturnType<typeof defineFeature>) {
  const registry = createRegistry([feature]);
  const logger = stubLogger();
  const db = openDatabase(':memory:');
  return { deps: { registry, logger, db }, logger, db, registry };
}

describe('dispatchInteraction', () => {
  it('runs the matching command with a handler context', async () => {
    const execute = vi.fn(async () => undefined);
    const { deps, db, registry } = setup(
      defineFeature({ name: 'general', commands: [command({ data: slash('ping'), execute })] }),
    );
    const interaction = stubInteraction('command', 'ping');

    await dispatchInteraction(interaction, deps);

    expect(execute).toHaveBeenCalledTimes(1);
    const ctx = execute.mock.calls[0]![1 as never] as Record<string, unknown>;
    expect(ctx).toMatchObject({ params: {}, db, registry, feature: 'general' });
    expect(ctx.client).toBe(interaction.client);
  });

  it('routes autocomplete to the command', async () => {
    const autocomplete = vi.fn(async () => undefined);
    const { deps } = setup(
      defineFeature({
        name: 'a',
        commands: [command({ data: slash('find'), execute: vi.fn(), autocomplete })],
      }),
    );
    await dispatchInteraction(stubInteraction('autocomplete', 'find'), deps);
    expect(autocomplete).toHaveBeenCalledTimes(1);
  });

  it('passes route params to a button handler', async () => {
    const handle = vi.fn(async () => undefined);
    const { deps } = setup(
      defineFeature({ name: 'moderation', components: [button('moderation:ban/:userId', handle)] }),
    );
    await dispatchInteraction(stubInteraction('button', 'moderation:ban/42'), deps);
    expect(handle.mock.calls[0]![1 as never]).toMatchObject({ params: { userId: '42' } });
  });

  it('routes select menus and modals by kind', async () => {
    const onSelect = vi.fn(async () => undefined);
    const onModal = vi.fn(async () => undefined);
    const { deps } = setup(
      defineFeature({
        name: 'a',
        components: [select('a:pick', onSelect), modal('a:pick', onModal)],
      }),
    );
    await dispatchInteraction(stubInteraction('select', 'a:pick'), deps);
    await dispatchInteraction(stubInteraction('modal', 'a:pick'), deps);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onModal).toHaveBeenCalledTimes(1);
  });

  it('tells the user when nothing handles the interaction', async () => {
    const { deps } = setup(defineFeature({ name: 'a' }));
    const interaction = stubInteraction('button', 'gone/1');
    await dispatchInteraction(interaction, deps);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
  });

  it('answers with an ephemeral error when a handler throws before replying', async () => {
    const { deps, logger } = setup(
      defineFeature({
        name: 'a',
        commands: [
          command({
            data: slash('boom'),
            execute: async () => {
              throw new Error('kaboom');
            },
          }),
        ],
      }),
    );
    const interaction = stubInteraction('command', 'boom');

    await dispatchInteraction(interaction, deps);

    expect(logger.error).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('follows up when a handler throws after deferring', async () => {
    const { deps } = setup(
      defineFeature({
        name: 'a',
        commands: [
          command({
            data: slash('slow'),
            execute: async interaction => {
              await interaction.deferReply();
              throw new Error('late failure');
            },
          }),
        ],
      }),
    );
    const interaction = stubInteraction('command', 'slow');

    await dispatchInteraction(interaction, deps);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
  });

  it('does not reject when the error reply itself fails', async () => {
    const { deps, logger } = setup(
      defineFeature({
        name: 'a',
        commands: [
          command({
            data: slash('boom'),
            execute: async () => {
              throw new Error('kaboom');
            },
          }),
        ],
      }),
    );
    const interaction = stubInteraction('command', 'boom', { failReply: true });

    await expect(dispatchInteraction(interaction, deps)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
