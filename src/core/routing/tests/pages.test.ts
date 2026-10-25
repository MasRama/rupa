import {
  ButtonStyle,
  MessageFlags,
  MessageFlagsBitField,
  type ButtonInteraction,
  type RepliableInteraction,
} from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { openDatabase } from '@/core/database';
import { defineFeature } from '@/core/feature';
import type { UsageEvent } from '@/core/usage';
import type { HandlerContext } from '../definitions';
import { pages, pageWindow } from '../pages';
import { createRegistry } from '../registry';
import { dispatchInteraction } from '../router';
import { stubInteraction, stubLogger } from './fixtures';

const letters = 'abcdefghijklmnopqrstuvw'.split(''); // 23 items

function lettersPages(items: string[] = letters) {
  return pages('demo:letters/:prefix', {
    pageSize: 10,
    count: () => items.length,
    render: ({ page, pageCount, offset, limit }, ctx) => ({
      content: `${ctx.params.prefix} ${page}/${pageCount}: ${items.slice(offset, offset + limit).join('')}`,
    }),
  });
}

/** The parts of a nav row a test cares about. */
const buttons = (message: { components: { toJSON(): unknown }[] }) =>
  message.components.flatMap(row =>
    (row.toJSON() as { components: Record<string, unknown>[] }).components.map(button => ({
      id: button.custom_id,
      label: button.label,
      disabled: button.disabled ?? false,
    })),
  );

const ctx = {} as HandlerContext;
const opener = () => stubInteraction('command', 'x') as unknown as RepliableInteraction;

describe('pageWindow', () => {
  it('works out the offset and how many pages there are', () => {
    expect(pageWindow(23, 10, 2)).toEqual({
      page: 2,
      pageCount: 3,
      total: 23,
      offset: 10,
      limit: 10,
    });
    expect(pageWindow(23, 10, 3)).toMatchObject({ offset: 20, limit: 10 });
  });

  it('keeps the page within range, with one empty page when there is nothing', () => {
    expect(pageWindow(23, 10, 9)).toMatchObject({ page: 3, offset: 20 });
    expect(pageWindow(23, 10, 0)).toMatchObject({ page: 1, offset: 0 });
    expect(pageWindow(23, 10, Number.NaN)).toMatchObject({ page: 1 });
    expect(pageWindow(0, 10, 1)).toEqual({ page: 1, pageCount: 1, total: 0, offset: 0, limit: 10 });
  });
});

describe('pages', () => {
  it('renders the first page with buttons to move between pages', async () => {
    const message = await lettersPages().first(opener(), ctx, {
      prefix: 'p',
    });

    expect(message.content).toBe('p 1/3: abcdefghij');
    expect(buttons(message)).toEqual([
      { id: 'demo:letters/p/0', label: '◀', disabled: true },
      { id: 'demo:letters/p/1', label: '1 / 3', disabled: true },
      { id: 'demo:letters/p/2', label: '▶', disabled: false },
    ]);
  });

  it('leaves the buttons out when everything fits on one page', async () => {
    const message = await lettersPages(['a', 'b']).first(opener(), ctx, {
      prefix: 'p',
    });
    expect(message.components).toEqual([]);
  });

  it('refuses a page size that is not a positive whole number', () => {
    expect(() => pages('a:b', { pageSize: 0, count: () => 0, render: () => ({}) })).toThrow(
      RangeError,
    );
  });
});

function clickSetup(items: string[] = letters) {
  const list = lettersPages(items);
  const registry = createRegistry([defineFeature({ name: 'demo', components: [list] })]);
  const events: UsageEvent[] = [];
  const deps = {
    registry,
    db: openDatabase(':memory:'),
    logger: stubLogger(),
    usage: { record: (event: UsageEvent) => void events.push(event) },
  };
  const click = (
    customId: string,
    options: { userId?: string; openerId?: string; ephemeral?: boolean } = {},
  ) => {
    const interaction = stubInteraction('button', customId, { userId: options.userId ?? 'user-1' });
    const button = Object.assign(interaction, {
      message: {
        flags: new MessageFlagsBitField(options.ephemeral ? MessageFlags.Ephemeral : 0),
        interactionMetadata: { user: { id: options.openerId ?? 'user-1' } },
      },
      update: vi.fn(async (_message: unknown) => undefined),
    });
    return button as typeof button & ButtonInteraction;
  };
  return { deps, events, click };
}

describe('turning pages', () => {
  it('updates the message to the page on the button', async () => {
    const { deps, click } = clickSetup();
    const interaction = click('demo:letters/p/3');
    await dispatchInteraction(interaction, deps);

    const update = vi.mocked(interaction.update).mock.calls[0]![0] as never as {
      content: string;
      components: { toJSON(): unknown }[];
    };
    expect(update.content).toBe('p 3/3: uvw');
    expect(buttons(update).map(button => button.disabled)).toEqual([false, true, true]);
  });

  it('shows the last page when the list shrank since the buttons were sent', async () => {
    const { deps, click } = clickSetup(['a', 'b', 'c']);
    const interaction = click('demo:letters/p/3');
    await dispatchInteraction(interaction, deps);
    expect(vi.mocked(interaction.update).mock.calls[0]![0]).toMatchObject({
      content: 'p 1/1: abc',
      components: [],
    });
  });

  it('lets only the person who opened a public list turn its pages', async () => {
    const { deps, events, click } = clickSetup();
    const interaction = click('demo:letters/p/2', { userId: 'someone-else' });
    await dispatchInteraction(interaction, deps);

    expect(interaction.update).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Only the person who opened this list can turn its pages.',
      flags: MessageFlags.Ephemeral,
    });
    expect(events).toEqual([
      expect.objectContaining({ target: 'demo:letters/:prefix/:page', outcome: 'blocked' }),
    ]);
  });

  it('lets anyone who can see an ephemeral list turn its pages', async () => {
    const { deps, click } = clickSetup();
    const interaction = click('demo:letters/p/2', { userId: 'someone-else', ephemeral: true });
    await dispatchInteraction(interaction, deps);
    expect(interaction.update).toHaveBeenCalled();
  });
});

describe('button styles', () => {
  it('uses secondary buttons', async () => {
    const message = await lettersPages().first(opener(), ctx, {
      prefix: 'p',
    });
    const row = message.components[0]!.toJSON() as { components: { style: number }[] };
    expect(row.components.map(button => button.style)).toEqual([
      ButtonStyle.Secondary,
      ButtonStyle.Secondary,
      ButtonStyle.Secondary,
    ]);
  });
});
