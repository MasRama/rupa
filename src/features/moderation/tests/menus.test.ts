import { PermissionFlagsBits, type Message, type User } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { HandlerContext } from '@/core';
import { migrate, openDatabase } from '@/core/database';
import { stubLogger } from '@/core/routing/tests/fixtures';
import { coreSchema } from '@/core/schema';
import { writeSettings } from '@/core/settings';
import { reportMenu, reportEmbed } from '../commands/report';
import { warnMenu } from '../commands/warn';
import { moderation } from '../index';
import { moderationSettings } from '../settings';

const user = (id: string, username = `user${id}`) =>
  ({ id, username, toString: () => `<@${id}>` }) as unknown as User;

const message = (content: string, attachments = 0) =>
  ({
    id: 'm1',
    url: 'https://discord.com/channels/g1/c1/m1',
    content,
    author: user('a1', 'author'),
    channelId: 'c1',
    attachments: { size: attachments },
    createdTimestamp: Date.parse('2026-10-26T08:00:00Z'),
  }) as unknown as Message;

describe('reportEmbed', () => {
  it('names the author, channel and reporter and links the message', () => {
    const embed = reportEmbed(message('buy cheap nitro'), user('r1', 'reporter')).toJSON();
    expect(embed.title).toBe('Message reported');
    expect(embed.url).toBe('https://discord.com/channels/g1/c1/m1');
    expect(embed.fields).toEqual([
      { name: 'Author', value: '<@a1> (author)', inline: true },
      { name: 'Channel', value: '<#c1>', inline: true },
      { name: 'Reported by', value: '<@r1>', inline: true },
      { name: 'Message', value: 'buy cheap nitro' },
    ]);
  });

  it('shortens long messages and mentions attachments', () => {
    const embed = reportEmbed(message('x'.repeat(2000), 2), user('r1')).toJSON();
    const text = embed.fields!.at(-1)!.value;
    expect(text).toHaveLength(1024);
    expect(text.endsWith('…\n*2 attachment(s)*')).toBe(true);
    expect(reportEmbed(message(''), user('r1')).toJSON().fields!.at(-1)!.value).toBe('*No text*');
  });
});

describe('Report message', () => {
  function run(logChannel: string | null, send = vi.fn(async () => undefined)) {
    const db = openDatabase(':memory:');
    migrate(db, [coreSchema, moderation]);
    if (logChannel) {
      writeSettings(db, moderationSettings, {
        feature: 'moderation',
        guildId: 'g1',
        values: { logChannel },
        updatedBy: 'admin',
      });
    }
    const interaction = {
      guildId: 'g1',
      user: user('r1', 'reporter'),
      targetMessage: message('spam'),
      guild: {
        id: 'g1',
        channels: { fetch: async () => ({ isSendable: () => true, send }) },
      },
      inCachedGuild: () => true,
      reply: vi.fn(async () => undefined),
    };
    const ctx = { db, logger: stubLogger(), feature: 'moderation' } as unknown as HandlerContext;
    return { interaction, done: reportMenu.execute(interaction as never, ctx), send };
  }

  it('posts the report to the log channel and thanks the reporter privately', async () => {
    const { interaction, done, send } = run('123456789012345678');
    await done;
    expect(send).toHaveBeenCalledWith({ embeds: [expect.anything()] });
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Thanks, the moderators have been told.' }),
    );
  });

  it('says so when the server has no log channel', async () => {
    const { interaction, done } = run(null);
    await done;
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'This server has no moderation log channel yet. Ask an admin to set one.',
      }),
    );
  });

  it('says so when the log channel cannot be reached', async () => {
    const { interaction, done } = run(
      '123456789012345678',
      vi.fn(async () => {
        throw new Error('Missing Access');
      }),
    );
    await done;
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'The report could not be posted to the log channel. Please tell a moderator.',
      }),
    );
  });

  it('is a message menu with a cooldown, for servers only', () => {
    const body = reportMenu.data.toJSON();
    expect(reportMenu.type).toBe('message-command');
    expect(body.contexts).toEqual([0]);
    expect(reportMenu.guards).toHaveLength(1);
  });
});

describe('Warn', () => {
  it('is a user menu limited to moderators', () => {
    const body = warnMenu.data.toJSON();
    expect(warnMenu.type).toBe('user-command');
    expect(body.default_member_permissions).toBe(PermissionFlagsBits.ModerateMembers.toString());
    expect(body.contexts).toEqual([0]);
  });

  it('is mounted with Report message', () => {
    expect(moderation.commands).toEqual(expect.arrayContaining([warnMenu, reportMenu]));
  });
});
