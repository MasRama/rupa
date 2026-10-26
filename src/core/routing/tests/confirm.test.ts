import {
  ButtonStyle,
  MessageFlags,
  MessageFlagsBitField,
  type ButtonInteraction,
} from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { openDatabase } from '@/core/database';
import { defineFeature } from '@/core/feature';
import type { UsageEvent } from '@/core/usage';
import { confirm, type ConfirmOptions } from '../confirm';
import type { Guard } from '../guards';
import { createRegistry } from '../registry';
import { dispatchInteraction } from '../router';
import { stubInteraction, stubLogger } from './fixtures';

const MINUTE = 60_000;

function setup(options: Partial<ConfirmOptions<'demo:wipe/:itemId'>> = {}) {
  const onConfirm = vi.fn(async (..._args: unknown[]) => undefined);
  const prompt = confirm('demo:wipe/:itemId', { onConfirm, ...options });
  const registry = createRegistry([defineFeature({ name: 'demo', components: [prompt] })]);
  const events: UsageEvent[] = [];
  const deps = {
    registry,
    db: openDatabase(':memory:'),
    logger: stubLogger(),
    usage: { record: (event: UsageEvent) => void events.push(event) },
  };
  const click = async (
    customId: string,
    options: { userId?: string; openerId?: string; ephemeral?: boolean; ageMs?: number } = {},
  ) => {
    const interaction = stubInteraction('button', customId, { userId: options.userId ?? 'user-1' });
    const button = Object.assign(interaction, {
      message: {
        createdTimestamp: Date.now() - (options.ageMs ?? 0),
        flags: new MessageFlagsBitField(options.ephemeral ? MessageFlags.Ephemeral : 0),
        interactionMetadata: { user: { id: options.openerId ?? 'user-1' } },
      },
      update: vi.fn(async (_message: unknown) => undefined),
    }) as typeof interaction & ButtonInteraction;
    await dispatchInteraction(button, deps);
    return button;
  };
  return { prompt, onConfirm, events, click };
}

describe('confirm buttons', () => {
  it('builds a danger button to confirm and a secondary one to cancel', () => {
    const { prompt } = setup({ confirmLabel: 'Wipe' });
    const row = prompt.buttons({ itemId: '42' }).toJSON() as {
      components: { custom_id: string; label: string; style: number }[];
    };
    expect(row.components).toEqual([
      expect.objectContaining({
        custom_id: 'demo:wipe/42/yes',
        label: 'Wipe',
        style: ButtonStyle.Danger,
      }),
      expect.objectContaining({
        custom_id: 'demo:wipe/42/no',
        label: 'Cancel',
        style: ButtonStyle.Secondary,
      }),
    ]);
  });

  it('labels the confirm button "Confirm" unless told otherwise', () => {
    const { prompt } = setup({ style: ButtonStyle.Primary });
    const row = prompt.buttons({ itemId: '1' }).toJSON() as {
      components: { label: string; style: number }[];
    };
    expect(row.components[0]).toMatchObject({ label: 'Confirm', style: ButtonStyle.Primary });
  });
});

describe('answering a confirmation', () => {
  it('runs onConfirm with the route params when confirmed', async () => {
    const { onConfirm, click } = setup();
    const interaction = await click('demo:wipe/42/yes');
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0]![0]).toBe(interaction);
    expect((onConfirm.mock.calls[0]![1] as { params: unknown }).params).toEqual({ itemId: '42' });
    expect(interaction.update).not.toHaveBeenCalled();
  });

  it('says it was cancelled and removes the buttons when cancelled', async () => {
    const { onConfirm, click } = setup({ cancelled: 'Kept it.' });
    const interaction = await click('demo:wipe/42/no');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledWith({
      content: 'Kept it.',
      embeds: [],
      components: [],
    });
  });

  it('runs onCancel instead when given one', async () => {
    const onCancel = vi.fn(async (..._args: unknown[]) => undefined);
    const { click } = setup({ onCancel });
    const interaction = await click('demo:wipe/42/no');
    expect(onCancel).toHaveBeenCalledOnce();
    expect((onCancel.mock.calls[0]![1] as { params: unknown }).params).toEqual({ itemId: '42' });
    expect(interaction.update).not.toHaveBeenCalled();
  });

  it('runs its guards only when confirming, so cancelling always works', async () => {
    const guard: Guard = vi.fn(() => 'No wiping today.');
    const { onConfirm, click } = setup({ guards: [guard] });

    const yes = await click('demo:wipe/42/yes');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(yes.reply).toHaveBeenCalledWith({
      content: 'No wiping today.',
      flags: MessageFlags.Ephemeral,
    });

    const no = await click('demo:wipe/42/no');
    expect(no.update).toHaveBeenCalledWith(expect.objectContaining({ content: 'Cancelled.' }));
    expect(guard).toHaveBeenCalledOnce();
  });

  it('lets only the person who asked answer a public confirmation', async () => {
    const { onConfirm, events, click } = setup();
    const interaction = await click('demo:wipe/42/yes', { userId: 'someone-else' });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Only the person who asked can answer this.',
      flags: MessageFlags.Ephemeral,
    });
    expect(events).toEqual([
      expect.objectContaining({ target: 'demo:wipe/:itemId/:choice', outcome: 'blocked' }),
    ]);
  });

  it('expires after 15 minutes by default, without running either handler', async () => {
    const { onConfirm, click } = setup();
    expect(onConfirm).not.toHaveBeenCalled();
    const late = await click('demo:wipe/42/yes', { ageMs: 16 * MINUTE });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(late.update).toHaveBeenCalledWith({
      content: 'This confirmation has expired. Run the command again.',
      embeds: [],
      components: [],
    });

    await click('demo:wipe/42/yes', { ageMs: 14 * MINUTE });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('takes a different expiry', async () => {
    const { onConfirm, click } = setup({ expiresAfter: '1m' });
    await click('demo:wipe/42/yes', { ageMs: 2 * MINUTE });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
