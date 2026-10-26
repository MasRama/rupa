import { MessageFlags } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { HandlerContext } from '@/core';
import { migrate, openDatabase } from '@/core/database';
import { stubLogger } from '@/core/routing/tests/fixtures';
import { coreSchema } from '@/core/schema';
import { rolesCommand } from '../commands/roles';
import { openPicker, pickRoles } from '../components/picker';
import { roles } from '../index';
import { changeSummary, panelProblem, roleChanges } from '../logic';
import { createPanelRepository } from '../repository';

const role = (id: string, position: number, extra: { managed?: boolean } = {}) => ({
  id,
  name: `role-${id}`,
  position,
  managed: extra.managed ?? false,
});

function world() {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema, roles]);
  return { db, repo: createPanelRepository(db) };
}

describe('panel repository', () => {
  it('keeps a panel with its roles in order', () => {
    const { repo } = world();
    const id = repo.create({
      guildId: 'g1',
      channelId: 'c1',
      title: 'Pronouns',
      description: null,
      single: false,
      createdBy: 'admin',
      roleIds: ['r2', 'r1', 'r3'],
    });
    repo.setMessage(id, 'm1');
    expect(repo.get(id)).toEqual({
      id,
      guildId: 'g1',
      channelId: 'c1',
      messageId: 'm1',
      title: 'Pronouns',
      description: null,
      single: false,
      roleIds: ['r2', 'r1', 'r3'],
    });
    expect(repo.get(999)).toBeNull();
  });
});

describe('panelProblem', () => {
  const limits = { everyoneId: 'g1', botTopPosition: 10 };

  it('accepts roles below the bot', () => {
    expect(panelProblem([role('a', 1), role('b', 9)], limits)).toBeNull();
  });

  it('refuses @everyone, managed roles and roles at or above the bot', () => {
    expect(panelProblem([role('g1', 0)], limits)).toBe('@everyone cannot be on a role panel.');
    expect(panelProblem([role('a', 1, { managed: true })], limits)).toBe(
      'role-a belongs to a bot or an integration, so nobody can be given it.',
    );
    expect(panelProblem([role('a', 10)], limits)).toBe(
      'role-a is not below my highest role, so I cannot give it out. Move my role above it.',
    );
  });
});

describe('roleChanges', () => {
  it('adds what was picked and removes what was unpicked, only among the offered roles', () => {
    expect(
      roleChanges({
        offered: ['a', 'b', 'c'],
        selected: ['a', 'c', 'not-offered'],
        current: ['b', 'c', 'other'],
      }),
    ).toEqual({ add: ['a'], remove: ['b'] });
  });

  it('changes nothing when the choice matches', () => {
    expect(roleChanges({ offered: ['a', 'b'], selected: ['a'], current: ['a'] })).toEqual({
      add: [],
      remove: [],
    });
  });
});

describe('changeSummary', () => {
  it('lists added, removed and skipped roles', () => {
    expect(changeSummary({ added: ['a', 'b'], removed: ['c'], skipped: [] })).toBe(
      'Added <@&a>, <@&b>. Removed <@&c>.',
    );
    expect(changeSummary({ added: [], removed: [], skipped: ['d'] })).toBe(
      'No changes. Skipped <@&d>: I can no longer give it out.',
    );
    expect(changeSummary({ added: [], removed: [], skipped: [] })).toBe('No changes.');
  });
});

/** A server with roles a (1), b (2), high (20) and the bot's top role at 10. */
function server(memberRoles: string[]) {
  const { db, repo } = world();
  const guildRoles = new Map(
    [role('a', 1), role('b', 2), role('high', 20)].map(entry => [entry.id, entry]),
  );
  const held = new Set(memberRoles);
  const member = {
    roles: {
      cache: { has: (id: string) => held.has(id), keys: () => held.keys() },
      add: vi.fn(async (ids: string[]) => ids.forEach(id => held.add(id))),
      remove: vi.fn(async (ids: string[]) => ids.forEach(id => held.delete(id))),
    },
  };
  const guild = {
    id: 'g1',
    roles: { cache: guildRoles, everyone: { id: 'g1' } },
    members: { fetchMe: async () => ({ roles: { highest: { position: 10 } } }) },
  };
  const ctx = { db, logger: stubLogger(), feature: 'roles' } as unknown as HandlerContext;
  const click = (extra: Record<string, unknown> = {}) => ({
    guild,
    guildId: 'g1',
    member,
    user: { id: 'u1', username: 'u1' },
    inCachedGuild: () => true,
    reply: vi.fn(async (_message: unknown) => undefined),
    update: vi.fn(async (_message: unknown) => undefined),
    ...extra,
  });
  return { repo, ctx, member, held, click };
}

describe('choosing roles', () => {
  it('shows a private picker with the roles the member already has ticked', async () => {
    const s = server(['b']);
    const id = s.repo.create({
      guildId: 'g1',
      channelId: 'c1',
      title: 'Colours',
      description: null,
      single: false,
      createdBy: 'admin',
      roleIds: ['a', 'b', 'gone'],
    });
    const i = s.click();
    await openPicker.handle(i as never, { ...s.ctx, params: { panelId: String(id) } } as never);

    const reply = i.reply.mock.calls[0]![0] as {
      components: { toJSON(): { components: Record<string, unknown>[] } }[];
      flags: number;
    };
    expect(reply.flags).toBe(MessageFlags.Ephemeral);
    const menu = reply.components[0]!.toJSON().components[0]!;
    expect(menu).toMatchObject({ custom_id: `roles:pick/${id}`, min_values: 0, max_values: 2 });
    expect(menu.options).toEqual([
      expect.objectContaining({ value: 'a', label: 'role-a', default: false }),
      expect.objectContaining({ value: 'b', label: 'role-b', default: true }),
    ]);
  });

  it('allows one role on a single-choice panel', async () => {
    const s = server([]);
    const id = s.repo.create({
      guildId: 'g1',
      channelId: 'c1',
      title: 'Team',
      description: null,
      single: true,
      createdBy: 'admin',
      roleIds: ['a', 'b'],
    });
    const i = s.click();
    await openPicker.handle(i as never, { ...s.ctx, params: { panelId: String(id) } } as never);
    const reply = i.reply.mock.calls[0]![0] as {
      components: { toJSON(): { components: Record<string, unknown>[] } }[];
    };
    expect(reply.components[0]!.toJSON().components[0]).toMatchObject({ max_values: 1 });
  });

  it('says so when the panel is gone', async () => {
    const s = server([]);
    const i = s.click();
    await openPicker.handle(i as never, { ...s.ctx, params: { panelId: '42' } } as never);
    expect(i.reply).toHaveBeenCalledWith({
      content: 'This role panel no longer exists.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('gives and takes roles, skipping ones the bot can no longer give', async () => {
    const s = server(['b']);
    const id = s.repo.create({
      guildId: 'g1',
      channelId: 'c1',
      title: 'Colours',
      description: null,
      single: false,
      createdBy: 'admin',
      roleIds: ['a', 'b', 'high'],
    });
    const i = s.click({ values: ['a', 'high'] });
    await pickRoles.handle(i as never, { ...s.ctx, params: { panelId: String(id) } } as never);

    expect([...s.held].sort()).toEqual(['a']);
    expect(i.update).toHaveBeenCalledWith({
      content: 'Added <@&a>. Removed <@&b>. Skipped <@&high>: I can no longer give it out.',
      components: [],
    });
  });
});

describe('/roles panel', () => {
  function run(picked: ReturnType<typeof role>[]) {
    const s = server([]);
    const send = vi.fn(async (_message: unknown) => ({ id: 'm1' }));
    const i = s.click({
      channel: { id: 'c1', isSendable: () => true, send },
      options: {
        getRole: (name: string) => picked[Number(name.slice(4)) - 1] ?? null,
        getString: (name: string) => (name === 'title' ? 'Colours' : null),
        getBoolean: () => null,
      },
    });
    return { s, i, send, done: rolesCommand.execute(i as never, s.ctx) };
  }

  it('posts the panel and remembers its roles', async () => {
    const { s, i, send, done } = run([role('a', 1), role('b', 2), role('a', 1)]);
    await done;
    const posted = send.mock.calls[0]![0] as { components: { toJSON(): unknown }[] };
    expect(JSON.stringify(posted.components[0]!.toJSON())).toContain('"roles:open/1"');
    expect(s.repo.get(1)).toMatchObject({ title: 'Colours', messageId: 'm1', roleIds: ['a', 'b'] });
    expect(i.reply).toHaveBeenCalledWith({
      content: 'Role panel posted.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('refuses roles the bot cannot give', async () => {
    const { s, i, send, done } = run([role('a', 1), role('high', 20)]);
    await done;
    expect(send).not.toHaveBeenCalled();
    expect(s.repo.get(1)).toBeNull();
    expect(i.reply).toHaveBeenCalledWith({
      content:
        'role-high is not below my highest role, so I cannot give it out. Move my role above it.',
      flags: MessageFlags.Ephemeral,
    });
  });
});

describe('roles feature', () => {
  it('has /roles panel with up to ten roles', () => {
    const body = rolesCommand.data.toJSON();
    const panel = body.options?.[0] as { name: string; options: { name: string }[] };
    expect(panel.name).toBe('panel');
    expect(panel.options.filter(option => option.name.startsWith('role'))).toHaveLength(10);
    expect(roles.components).toEqual([openPicker, pickRoles]);
  });
});
