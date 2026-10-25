import { RESTJSONErrorCodes, type Client } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { JobContext } from '@/core';
import { createJobScheduler } from '@/core/jobs';
import { migrate, openDatabase } from '@/core/database';
import { createRegistry } from '@/core/routing/registry';
import { stubLogger } from '@/core/routing/tests/fixtures';
import { coreSchema } from '@/core/schema';
import { parseBanDuration } from '../duration';
import { moderation } from '../index';
import { scheduleUnban, unban } from '../jobs';
import { createCaseRepository } from '../repository';

function setup(removeBan: () => Promise<unknown> = async () => undefined) {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema, moderation]);
  const registry = createRegistry([moderation]);
  const jobs = createJobScheduler(db, registry);
  const guild = {
    id: 'g1',
    name: 'Rama Lab',
    bans: { remove: vi.fn(removeBan) },
    channels: { fetch: vi.fn() },
  };
  const user = (id: string) => ({ id, username: `user${id}`, toString: () => `<@${id}>` });
  const client = {
    user: user('bot'),
    guilds: { cache: new Map([['g1', guild]]) },
    users: { fetch: async (id: string) => user(id) },
  } as unknown as Client;
  const ctx = {
    db,
    logger: stubLogger(),
    client,
    registry,
    feature: 'moderation',
    jobs,
    attempt: 1,
  } satisfies JobContext;
  return { db, jobs, guild, ctx, cases: createCaseRepository(db) };
}

describe('parseBanDuration', () => {
  it('reads an optional duration of up to 365 days', () => {
    expect(parseBanDuration(null)).toEqual({ seconds: 0 });
    expect(parseBanDuration('7d')).toEqual({ seconds: 604_800 });
    expect(parseBanDuration('365d')).toEqual({ seconds: 31_536_000 });
    expect(parseBanDuration('400d')).toEqual({ error: 'Bans can last at most 365 days.' });
    expect(parseBanDuration('soon')).toEqual({
      error: 'Use a duration like 30s, 10m, 2h, 7d or 1h30m',
    });
  });
});

describe('case repository', () => {
  it('stores when a temporary ban ends, and unban cases', () => {
    const { cases } = setup();
    const base = { guildId: 'g1', userId: 'u1', moderatorId: 'm', reason: null };
    cases.add({ ...base, action: 'ban', expiresAt: '2026-11-01T12:00:00.000Z' });
    cases.add({ ...base, action: 'unban' });

    expect(cases.listForMember('g1', 'u1').map(entry => [entry.action, entry.expiresAt])).toEqual([
      ['unban', null],
      ['ban', '2026-11-01T12:00:00.000Z'],
    ]);
  });

  it('keeps cases recorded before temporary bans existed', () => {
    const db = openDatabase(':memory:');
    migrate(db, [{ ...moderation, migrations: moderation.migrations.slice(0, 1) }]);
    db.prepare(
      "INSERT INTO moderation_cases (guild_id, user_id, moderator_id, action) VALUES ('g', 'u', 'm', 'kick')",
    ).run();

    migrate(db, [moderation]);
    expect(createCaseRepository(db).listForMember('g', 'u')).toEqual([
      expect.objectContaining({ action: 'kick', expiresAt: null }),
    ]);
  });
});

describe('scheduleUnban', () => {
  const pending = (db: ReturnType<typeof setup>['db']) =>
    db.prepare('SELECT key, run_at FROM rupa_jobs').all();

  it('schedules the unban for a temporary ban', () => {
    vi.useFakeTimers({ now: new Date('2026-10-25T12:00:00Z') });
    const { db, jobs } = setup();
    scheduleUnban(jobs, { guildId: 'g1', userId: 'u1', caseId: 3, seconds: 3600 });
    expect(pending(db)).toEqual([{ key: 'g1:u1', run_at: '2026-10-25T13:00:00.000Z' }]);
    vi.useRealTimers();
  });

  it('cancels a pending unban when the new ban is permanent', () => {
    const { db, jobs } = setup();
    scheduleUnban(jobs, { guildId: 'g1', userId: 'u1', caseId: 3, seconds: 3600 });
    scheduleUnban(jobs, { guildId: 'g1', userId: 'u1', caseId: 4, seconds: 0 });
    expect(pending(db)).toEqual([]);
  });
});

describe('unban job', () => {
  it('lifts the ban and records an unban case by the bot', async () => {
    const { guild, ctx, cases } = setup();
    await unban.run({ guildId: 'g1', userId: 'u1', caseId: 3 }, ctx);

    expect(guild.bans.remove).toHaveBeenCalledWith('u1', 'Temporary ban from case #3 ended');
    expect(cases.listForMember('g1', 'u1')).toEqual([
      expect.objectContaining({
        action: 'unban',
        moderatorId: 'bot',
        reason: 'Temporary ban from case #3 ended',
      }),
    ]);
  });

  it('ends quietly when the ban was already lifted', async () => {
    const { ctx, cases } = setup(async () => {
      throw Object.assign(new Error('Unknown Ban'), { code: RESTJSONErrorCodes.UnknownBan });
    });
    await expect(
      unban.run({ guildId: 'g1', userId: 'u1', caseId: 3 }, ctx),
    ).resolves.toBeUndefined();
    expect(cases.listForMember('g1', 'u1')).toEqual([]);
  });

  it('lets other errors through so the job is retried', async () => {
    const { ctx } = setup(async () => {
      throw new Error('Missing Permissions');
    });
    await expect(unban.run({ guildId: 'g1', userId: 'u1', caseId: 3 }, ctx)).rejects.toThrow(
      'Missing Permissions',
    );
  });

  it('does nothing when the bot left the server', async () => {
    const { ctx, cases } = setup();
    await unban.run({ guildId: 'gone', userId: 'u1', caseId: 3 }, ctx);
    expect(cases.listForMember('gone', 'u1')).toEqual([]);
  });
});
