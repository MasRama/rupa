import { MessageFlags } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { openDatabase } from '@/core/database';
import type { UsageEvent } from '@/core/usage';
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

describe('usage recording', () => {
  function recorded(feature: ReturnType<typeof defineFeature>) {
    const events: UsageEvent[] = [];
    const { deps, logger } = setup(feature);
    return {
      events,
      logger,
      deps: { ...deps, usage: { record: (event: UsageEvent) => void events.push(event) } },
    };
  }

  it('records a successful command with its duration', async () => {
    const { deps, events } = recorded(
      defineFeature({
        name: 'general',
        commands: [command({ data: slash('ping'), execute: vi.fn() })],
      }),
    );
    await dispatchInteraction(stubInteraction('command', 'ping'), deps);

    expect(events).toEqual([
      {
        at: expect.any(Date),
        feature: 'general',
        kind: 'command',
        target: '/ping',
        guildId: 'guild-1',
        userId: 'user-1',
        outcome: 'ok',
        durationMs: expect.any(Number),
      },
    ]);
  });

  it('records a failing handler as an error', async () => {
    const { deps, events } = recorded(
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
    await dispatchInteraction(stubInteraction('command', 'boom'), deps);
    expect(events[0]?.outcome).toBe('error');
  });

  it('includes the subcommand group and subcommand in the target', async () => {
    const { deps, events } = recorded(
      defineFeature({
        name: 'a',
        commands: [command({ data: slash('ticket'), execute: vi.fn() })],
      }),
    );
    await dispatchInteraction(
      stubInteraction('command', 'ticket', { group: 'admin', subcommand: 'close' }),
      deps,
    );
    expect(events[0]?.target).toBe('/ticket admin close');
  });

  it('records components by route pattern, not by custom id', async () => {
    const { deps, events } = recorded(
      defineFeature({
        name: 'moderation',
        components: [button('moderation:ban/:userId', vi.fn())],
      }),
    );
    await dispatchInteraction(stubInteraction('button', 'moderation:ban/42'), deps);
    expect(events[0]).toMatchObject({ kind: 'button', target: 'moderation:ban/:userId' });
  });

  it('does not record autocomplete or unhandled interactions', async () => {
    const { deps, events } = recorded(
      defineFeature({
        name: 'a',
        commands: [command({ data: slash('find'), execute: vi.fn(), autocomplete: vi.fn() })],
      }),
    );
    await dispatchInteraction(stubInteraction('autocomplete', 'find'), deps);
    await dispatchInteraction(stubInteraction('button', 'gone/1'), deps);
    expect(events).toEqual([]);
  });

  it('still answers normally when recording throws', async () => {
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
    const usage = {
      record: () => {
        throw new Error('database is closed');
      },
    };
    const interaction = stubInteraction('command', 'boom');

    await expect(dispatchInteraction(interaction, { ...deps, usage })).resolves.toBeUndefined();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('guards', () => {
  const refuse = (message: string) => () => message;

  function recorded(feature: ReturnType<typeof defineFeature>) {
    const events: UsageEvent[] = [];
    const { deps } = setup(feature);
    return {
      events,
      deps: { ...deps, usage: { record: (event: UsageEvent) => void events.push(event) } },
    };
  }

  it('answers a refusal privately, skips the handler and records it as blocked', async () => {
    const execute = vi.fn();
    const { deps, events } = recorded(
      defineFeature({
        name: 'a',
        commands: [command({ data: slash('daily'), guards: [refuse('Not yet.')], execute })],
      }),
    );
    const interaction = stubInteraction('command', 'daily');
    await dispatchInteraction(interaction, deps);

    expect(execute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Not yet.',
      flags: MessageFlags.Ephemeral,
    });
    expect(events).toEqual([
      expect.objectContaining({ target: '/daily', outcome: 'blocked', durationMs: 0 }),
    ]);
  });

  it('runs feature guards before the command guards, then the handler', async () => {
    const order: string[] = [];
    const { deps } = setup(
      defineFeature({
        name: 'a',
        guards: [() => (order.push('feature'), null)],
        commands: [
          command({
            data: slash('daily'),
            guards: [() => (order.push('command'), null)],
            execute: () => void order.push('handler'),
          }),
        ],
      }),
    );
    await dispatchInteraction(stubInteraction('command', 'daily'), deps);
    expect(order).toEqual(['feature', 'command', 'handler']);
  });

  it('gives component guards the route params and pattern', async () => {
    const guard = vi.fn(() => null);
    const { deps } = setup(
      defineFeature({
        name: 'a',
        components: [button('a:claim/:id', vi.fn(), { guards: [guard] })],
      }),
    );
    await dispatchInteraction(stubInteraction('button', 'a:claim/7'), deps);
    expect(guard.mock.calls[0]![1 as never]).toMatchObject({
      params: { id: '7' },
      target: 'a:claim/:id',
      feature: 'a',
    });
  });

  it('does not run guards for autocomplete', async () => {
    const guard = vi.fn(() => 'No.');
    const autocomplete = vi.fn();
    const { deps } = setup(
      defineFeature({
        name: 'a',
        guards: [guard],
        commands: [command({ data: slash('find'), execute: vi.fn(), autocomplete })],
      }),
    );
    await dispatchInteraction(stubInteraction('autocomplete', 'find'), deps);
    expect(guard).not.toHaveBeenCalled();
    expect(autocomplete).toHaveBeenCalled();
  });

  it('treats a guard that throws like a failing handler', async () => {
    const { deps, events } = recorded(
      defineFeature({
        name: 'a',
        commands: [
          command({
            data: slash('daily'),
            guards: [
              () => {
                throw new Error('guard broke');
              },
            ],
            execute: vi.fn(),
          }),
        ],
      }),
    );
    const interaction = stubInteraction('command', 'daily');
    await dispatchInteraction(interaction, deps);
    expect(events[0]?.outcome).toBe('error');
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Something went wrong') }),
    );
  });
});

describe('scheduling from handlers', () => {
  it('gives handlers ctx.jobs', async () => {
    const execute = vi.fn();
    const { deps } = setup(
      defineFeature({ name: 'a', commands: [command({ data: slash('later'), execute })] }),
    );
    await dispatchInteraction(stubInteraction('command', 'later'), deps);
    const ctx = execute.mock.calls[0]![1 as never] as { jobs: { schedule: unknown } };
    expect(typeof ctx.jobs.schedule).toBe('function');
  });
});
