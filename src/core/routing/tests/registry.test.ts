import { GatewayIntentBits } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { defineFeature } from '@/core/feature';
import { button, command, modal } from '../definitions';
import { createRegistry } from '../registry';
import { slash } from './fixtures';

const noop = async () => undefined;

describe('defineFeature', () => {
  it('fills missing lists with empty arrays', () => {
    const feature = defineFeature({ name: 'empty' });
    expect(feature.commands).toEqual([]);
    expect(feature.components).toEqual([]);
    expect(feature.events).toEqual([]);
    expect(feature.migrations).toEqual([]);
    expect(feature.intents).toEqual([]);
  });

  it('rejects names that are not kebab-case', () => {
    expect(() => defineFeature({ name: 'Bad Name' })).toThrow(/kebab-case/);
  });
});

describe('createRegistry', () => {
  it('indexes commands by name with their feature', () => {
    const ping = command({ data: slash('ping'), execute: noop });
    const registry = createRegistry([defineFeature({ name: 'general', commands: [ping] })]);
    expect(registry.commands.get('ping')).toEqual({
      feature: 'general',
      definition: ping,
      guards: [],
    });
  });

  it('throws when two features register the same command name', () => {
    const a = defineFeature({
      name: 'a',
      commands: [command({ data: slash('ban'), execute: noop })],
    });
    const b = defineFeature({
      name: 'b',
      commands: [command({ data: slash('ban'), execute: noop })],
    });
    expect(() => createRegistry([a, b])).toThrow(/"\/ban".*"a".*"b"/);
  });

  it('throws when two components of one kind share a pattern', () => {
    const a = defineFeature({ name: 'a', components: [button('x/:id', noop)] });
    const b = defineFeature({ name: 'b', components: [button('x/:id', noop)] });
    expect(() => createRegistry([a, b])).toThrow(/button "x\/:id".*"a".*"b"/);
  });

  it('allows the same pattern for different component kinds', () => {
    const feature = defineFeature({
      name: 'a',
      components: [button('x/:id', noop), modal('x/:id', noop)],
    });
    expect(() => createRegistry([feature])).not.toThrow();
  });

  it('throws on duplicate feature names', () => {
    expect(() =>
      createRegistry([defineFeature({ name: 'a' }), defineFeature({ name: 'a' })]),
    ).toThrow(/feature "a"/i);
  });

  it('finds a component by kind and custom id, with params', () => {
    const confirm = button('moderation:ban/:userId', noop);
    const registry = createRegistry([defineFeature({ name: 'moderation', components: [confirm] })]);

    expect(registry.findComponent('button', 'moderation:ban/42')).toEqual({
      feature: 'moderation',
      definition: confirm,
      guards: [],
      params: { userId: '42' },
    });
    expect(registry.findComponent('modal', 'moderation:ban/42')).toBeNull();
    expect(registry.findComponent('button', 'other/42')).toBeNull();
  });

  it('always requests Guilds and adds feature intents without duplicates', () => {
    const registry = createRegistry([
      defineFeature({ name: 'a', intents: [GatewayIntentBits.GuildMembers] }),
      defineFeature({
        name: 'b',
        intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.Guilds],
      }),
    ]);
    expect(registry.intents()).toEqual([GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]);
  });
});

describe('reserved names', () => {
  it('does not allow a feature named "rupa"', () => {
    expect(() => defineFeature({ name: 'rupa' })).toThrow(/reserved/);
  });
});
