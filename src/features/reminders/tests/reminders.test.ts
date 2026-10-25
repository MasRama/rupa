import type { Client } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { JobContext } from '@/core';
import { migrate, openDatabase } from '@/core/database';
import { createJobScheduler } from '@/core/jobs';
import { createRegistry } from '@/core/routing/registry';
import { stubLogger } from '@/core/routing/tests/fixtures';
import { coreSchema } from '@/core/schema';
import { reminders } from '../index';
import { formatReminderList, parseReminder } from '../input';
import { deliver } from '../jobs';
import { createReminderRepository } from '../repository';

const now = new Date('2026-10-25T12:00:00Z');

function setup(channel: { send: () => Promise<unknown> } | null) {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema, reminders]);
  const registry = createRegistry([reminders]);
  const dm = vi.fn(async () => undefined);
  const client = {
    channels: {
      fetch: async () => (channel ? { ...channel, isSendable: () => true } : null),
    },
    users: { fetch: async () => ({ send: dm }) },
  } as unknown as Client;
  const ctx = {
    db,
    logger: stubLogger(),
    client,
    registry,
    feature: 'reminders',
    jobs: createJobScheduler(db, registry),
    attempt: 1,
  } satisfies JobContext;
  const repository = createReminderRepository(db);
  const id = repository.add({
    userId: 'u1',
    guildId: 'g1',
    channelId: 'c1',
    text: 'stretch',
    remindAt: new Date('2026-10-25T12:10:00Z'),
  });
  return { ctx, dm, repository, id };
}

describe('parseReminder', () => {
  it('works out when to remind', () => {
    expect(parseReminder({ in: '10m', now, active: 0 })).toEqual({
      remindAt: new Date('2026-10-25T12:10:00Z'),
    });
  });

  it('refuses bad times, far-off times and too many reminders', () => {
    expect(parseReminder({ in: 'later', now, active: 0 })).toEqual({
      error: 'Use a duration like 30s, 10m, 2h, 7d or 1h30m',
    });
    expect(parseReminder({ in: '400d', now, active: 0 })).toEqual({
      error: 'Reminders can be at most 365 days ahead.',
    });
    expect(parseReminder({ in: '10m', now, active: 25 })).toEqual({
      error: 'You already have 25 reminders. Cancel one first.',
    });
  });
});

describe('formatReminderList', () => {
  it('lists reminders with their number and time', () => {
    expect(
      formatReminderList([
        { id: 4, text: 'stretch', remindAt: '2026-10-25T12:10:00.000Z' },
        { id: 9, text: 'x'.repeat(120), remindAt: '2026-10-26T08:00:00.000Z' },
      ]),
    ).toBe(`**#4** <t:1792930200:R> stretch\n**#9** <t:1793001600:R> ${'x'.repeat(79)}…`);
  });

  it('points to /remind set when there are none', () => {
    expect(formatReminderList([])).toBe('You have no reminders. Set one with `/remind set`.');
  });
});

describe('reminder repository', () => {
  it("lists a user's reminders soonest first and only removes their own", () => {
    const { repository, id } = setup(null);
    repository.add({
      userId: 'u1',
      guildId: null,
      channelId: 'c2',
      text: 'earlier',
      remindAt: new Date('2026-10-25T12:05:00Z'),
    });

    expect(repository.listForUser('u1').map(item => item.text)).toEqual(['earlier', 'stretch']);
    expect(repository.countForUser('u1')).toBe(2);
    expect(repository.remove(id, 'someone-else')).toBe(false);
    expect(repository.remove(id, 'u1')).toBe(true);
    expect(repository.get(id)).toBeNull();
  });
});

describe('deliver job', () => {
  it('posts in the channel, mentioning only the user, then forgets the reminder', async () => {
    const send = vi.fn(async () => undefined);
    const { ctx, repository, id } = setup({ send });
    await deliver.run({ reminderId: id }, ctx);

    expect(send).toHaveBeenCalledWith({
      content: '<@u1> Reminder: stretch',
      allowedMentions: { users: ['u1'] },
    });
    expect(repository.get(id)).toBeNull();
  });

  it('sends a DM when the channel is gone or closed to the bot', async () => {
    const { ctx, dm, repository, id } = setup({
      send: async () => {
        throw new Error('Missing Access');
      },
    });
    await deliver.run({ reminderId: id }, ctx);
    expect(dm).toHaveBeenCalledWith('Reminder: stretch');
    expect(repository.get(id)).toBeNull();
  });

  it('ignores a reminder that was cancelled', async () => {
    const send = vi.fn();
    const { ctx, repository, id } = setup({ send });
    repository.remove(id, 'u1');
    await deliver.run({ reminderId: id }, ctx);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('reminders feature', () => {
  it('provides /remind with a cooldown and the deliver job', () => {
    expect(reminders.commands.map(command => command.data.name)).toEqual(['remind']);
    expect(reminders.commands[0]?.guards).toHaveLength(1);
    expect(reminders.jobs).toEqual([deliver]);
  });
});
