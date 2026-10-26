import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  type GuildMember,
  type User,
} from 'discord.js';
import { describe, expect, it } from 'vitest';
import { defineFeature, userCommand } from '@/core';
import { createRegistry } from '@/core/routing/registry';
import { helpFields } from '../commands/help';
import { userInfoMenu } from '../commands/user-info-menu';
import { userinfoCommand } from '../commands/userinfo';
import { general } from '../index';
import { userEmbed } from '../user-embed';

const user = {
  id: '42',
  username: 'rama',
  displayName: 'Rama',
  createdTimestamp: Date.parse('2020-01-01T00:00:00Z'),
  displayAvatarURL: () => 'https://cdn.example/avatar.png',
} as unknown as User;

const fieldNames = (embed: ReturnType<typeof userEmbed>) =>
  embed.toJSON().fields?.map(field => field.name);

describe('userEmbed', () => {
  it('shows only account details without a server member, e.g. from a user install', () => {
    expect(fieldNames(userEmbed(user, null))).toEqual(['Username', 'ID', 'Account created']);
  });

  it('adds when they joined and their roles for a member', () => {
    const member = {
      guild: { id: 'g' },
      displayColor: 0xff0000,
      joinedTimestamp: Date.parse('2024-01-01T00:00:00Z'),
      premiumSinceTimestamp: null,
      roles: {
        cache: {
          filter: () => ({ sort: () => ({ map: () => ['<@&1>'] }) }),
        },
      },
    } as unknown as GuildMember;
    expect(fieldNames(userEmbed(user, member))).toEqual([
      'Username',
      'ID',
      'Account created',
      'Joined server',
      'Roles (1)',
    ]);
  });
});

describe('User info', () => {
  it.each([
    ['/userinfo', userinfoCommand.data.toJSON()],
    ['User info', userInfoMenu.data.toJSON()],
  ])('%s can be installed to a server or a user account', (_name, body) => {
    expect(body.integration_types).toEqual([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ]);
    expect(body.contexts).toEqual([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]);
  });

  it('is a right-click menu on users, mounted with a cooldown', () => {
    expect(userInfoMenu.type).toBe('user-command');
    expect(userInfoMenu.guards).toHaveLength(1);
    expect(general.commands).toContain(userInfoMenu);
  });
});

describe('helpFields', () => {
  it('lists slash commands by feature and right-click menus at the end', () => {
    const fields = helpFields(createRegistry([general]));
    expect(fields.at(0)?.name).toBe('general');
    expect(fields.at(0)?.value).toContain('`/ping`');
    expect(fields.at(-1)).toEqual({ name: 'Right-click menus', value: '**User info** on a user' });
  });

  it('escapes Markdown in menu names', () => {
    const feature = defineFeature({
      name: 'demo',
      commands: [
        userCommand({
          data: new ContextMenuCommandBuilder()
            .setName('Rate *this*')
            .setType(ApplicationCommandType.User),
          execute: () => undefined,
        }),
      ],
    });
    expect(helpFields(createRegistry([feature])).at(-1)?.value).toBe(
      '**Rate \\*this\\*** on a user',
    );
  });
});
