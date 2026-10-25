import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { describe, expect, it } from 'vitest';
import { defineFeature } from '@/core/feature';
import { command, messageCommand, userCommand } from '@/core/routing/definitions';
import { createRegistry } from '@/core/routing/registry';
import { buildCommandPayloads, planCommandDeploy, type RemoteCommand } from '../plan';

const search = () =>
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search notes')
    .addStringOption(option => option.setName('query').setDescription('Text to find'))
    .toJSON();

/** What Discord returns for `search()` after it was deployed. */
const deployedSearch = (): RemoteCommand => ({
  id: '111',
  application_id: '222',
  version: '333',
  type: 1,
  name: 'search',
  description: 'Search notes',
  default_member_permissions: null,
  dm_permission: true,
  nsfw: false,
  contexts: null,
  integration_types: [0],
  options: [{ type: 3, name: 'query', description: 'Text to find', required: false }],
});

describe('planCommandDeploy', () => {
  it('reports new local commands as added', () => {
    expect(planCommandDeploy([search()], [])).toEqual({
      added: ['/search'],
      changed: [],
      removed: [],
      unchanged: [],
    });
  });

  it('reports commands only Discord has as removed', () => {
    expect(planCommandDeploy([], [deployedSearch()]).removed).toEqual(['/search']);
  });

  it('ignores fields Discord adds and defaults it fills in', () => {
    expect(planCommandDeploy([search()], [deployedSearch()]).unchanged).toEqual(['/search']);
  });

  it('detects a changed description', () => {
    const remote = { ...deployedSearch(), description: 'Old text' };
    expect(planCommandDeploy([search()], [remote]).changed).toEqual(['/search']);
  });

  it('detects an option that became required', () => {
    const local = new SlashCommandBuilder()
      .setName('search')
      .setDescription('Search notes')
      .addStringOption(option =>
        option.setName('query').setDescription('Text to find').setRequired(true),
      )
      .toJSON();
    expect(planCommandDeploy([local], [deployedSearch()]).changed).toEqual(['/search']);
  });

  it('detects default member permissions being removed locally', () => {
    const remote = {
      ...deployedSearch(),
      default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
    };
    expect(planCommandDeploy([search()], [remote]).changed).toEqual(['/search']);
  });
});

const menu = (name: string, type: ApplicationCommandType.User | ApplicationCommandType.Message) =>
  new ContextMenuCommandBuilder().setName(name).setType(type);

/** What Discord returns for a deployed right-click command. */
const deployedMenu = (name: string, type: number): RemoteCommand => ({
  id: '444',
  application_id: '222',
  version: '555',
  type,
  name,
  description: '',
  default_member_permissions: null,
  dm_permission: true,
  nsfw: false,
  contexts: null,
  integration_types: [0],
});

describe('right-click commands in the plan', () => {
  const userInfo = () => menu('info', ApplicationCommandType.User).toJSON();

  it('labels commands by type and keeps same-named ones apart', () => {
    const plan = planCommandDeploy(
      [search(), userInfo(), menu('search', ApplicationCommandType.Message).toJSON()],
      [deployedSearch()],
    );
    expect(plan).toEqual({
      added: ['[user] info', '[message] search'],
      changed: [],
      removed: [],
      unchanged: ['/search'],
    });
  });

  it('treats a deployed menu as unchanged although Discord adds an empty description', () => {
    expect(planCommandDeploy([userInfo()], [deployedMenu('info', 2)]).unchanged).toEqual([
      '[user] info',
    ]);
  });

  it('removes a menu whose type changed and adds the new one', () => {
    const plan = planCommandDeploy([userInfo()], [deployedMenu('info', 3)]);
    expect(plan.added).toEqual(['[user] info']);
    expect(plan.removed).toEqual(['[message] info']);
  });

  it('notices when a menu becomes installable to user accounts', () => {
    const local = menu('info', ApplicationCommandType.User).setIntegrationTypes(0, 1).toJSON();
    expect(planCommandDeploy([local], [deployedMenu('info', 2)]).changed).toEqual(['[user] info']);
  });
});

describe('buildCommandPayloads', () => {
  it('includes slash commands and right-click commands in mount order', () => {
    const noop = () => undefined;
    const registry = createRegistry([
      defineFeature({
        name: 'a',
        commands: [
          userCommand({ data: menu('Info', ApplicationCommandType.User), execute: noop }),
          command({
            data: new SlashCommandBuilder().setName('ping').setDescription('Ping'),
            execute: noop,
          }),
          messageCommand({ data: menu('Report', ApplicationCommandType.Message), execute: noop }),
        ],
      }),
    ]);
    expect(buildCommandPayloads(registry).map(body => [body.type ?? 1, body.name])).toEqual([
      [1, 'ping'],
      [2, 'Info'],
      [3, 'Report'],
    ]);
  });
});
