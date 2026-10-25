import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { planCommandDeploy, type RemoteCommand } from '../plan';

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
      added: ['search'],
      changed: [],
      removed: [],
      unchanged: [],
    });
  });

  it('reports commands only Discord has as removed', () => {
    expect(planCommandDeploy([], [deployedSearch()]).removed).toEqual(['search']);
  });

  it('ignores fields Discord adds and defaults it fills in', () => {
    expect(planCommandDeploy([search()], [deployedSearch()]).unchanged).toEqual(['search']);
  });

  it('detects a changed description', () => {
    const remote = { ...deployedSearch(), description: 'Old text' };
    expect(planCommandDeploy([search()], [remote]).changed).toEqual(['search']);
  });

  it('detects an option that became required', () => {
    const local = new SlashCommandBuilder()
      .setName('search')
      .setDescription('Search notes')
      .addStringOption(option =>
        option.setName('query').setDescription('Text to find').setRequired(true),
      )
      .toJSON();
    expect(planCommandDeploy([local], [deployedSearch()]).changed).toEqual(['search']);
  });

  it('detects default member permissions being removed locally', () => {
    const remote = {
      ...deployedSearch(),
      default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
    };
    expect(planCommandDeploy([search()], [remote]).changed).toEqual(['search']);
  });
});
