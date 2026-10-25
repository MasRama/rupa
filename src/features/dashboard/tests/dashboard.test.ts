import { ChannelType, Collection, type Client } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { defineFeature } from '@/core/feature';
import { createRegistry } from '@/core/routing/registry';
import { stubLogger } from '@/core/routing/tests/fixtures';
import { coreSchema } from '@/core/schema';
import { defineSettings, setting } from '@/core/settings';
import { createUsageRecorder } from '@/core/usage';
import { createSessionStore, createWebApp, type GuildAccess } from '@/core/web';
import { dashboard } from '../index';

const URL_BASE = 'https://bot.example.com';

const guild = (id: string, name: string) => ({
  id,
  name,
  icon: null,
  iconURL: () => null,
  memberCount: 12,
  channels: {
    cache: new Collection([
      [`${id}1`, { id: `${id}1`, name: 'general', type: ChannelType.GuildText, rawPosition: 0 }],
      [`${id}2`, { id: `${id}2`, name: 'Voice', type: ChannelType.GuildVoice, rawPosition: 1 }],
    ]),
  },
  roles: {
    cache: new Collection([
      [`${id}9`, { id: `${id}9`, name: 'Mods', position: 1, managed: false }],
    ]),
  },
});

const pagesSettings = defineSettings({
  logChannel: setting.channel({ label: 'Log channel' }),
  modRole: setting.role({ label: 'Moderator role' }),
  dmMembers: setting.boolean({ label: 'DM members', default: true }),
  limit: setting.number({ label: 'Limit', min: 1, max: 5, integer: true }),
});

function setup() {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema]);
  const client = {
    guilds: {
      cache: new Collection([
        ['20', guild('20', 'Rama Lab')],
        ['40', guild('40', 'Other')],
      ]),
    },
  } as unknown as Client;
  const access: GuildAccess = {
    ready: () => true,
    canManage: async (_user, guildId) => guildId === '20',
    isOwner: async () => false,
  };
  const registry = createRegistry([
    defineFeature({ name: 'moderation', settings: pagesSettings }),
    defineFeature({ name: 'general' }),
    dashboard,
  ]);
  const app = createWebApp({
    registry,
    db,
    logger: stubLogger(),
    client,
    config: { port: 3000, url: URL_BASE, clientSecret: 's', ownerIds: [] },
    oauth: { authorizeUrl: () => 'https://discord.test', exchange: async () => ({}) as never },
    access,
  });
  const token = createSessionStore(db).create({
    id: '10',
    username: 'ren',
    avatar: null,
    guildIds: ['20', '30'],
  });
  const headers = { Cookie: `rupa_session=${token}` };
  const post = (path: string, fields: Record<string, string>) =>
    app.request(path, {
      method: 'POST',
      headers: { ...headers, Origin: URL_BASE },
      body: new URLSearchParams(fields),
    });
  const stored = () =>
    db.prepare('SELECT key, value FROM rupa_guild_settings ORDER BY key').all() as {
      key: string;
      value: string;
    }[];
  return { app, db, headers, post, stored };
}

describe('dashboard pages', () => {
  it('offers sign-in to visitors and sends signed-in users to their servers', async () => {
    const { app, headers } = setup();
    const visitor = await app.request('/');
    expect(visitor.status).toBe(200);
    expect(await visitor.text()).toContain('href="/auth/login"');

    const member = await app.request('/', { headers });
    expect(member.status).toBe(302);
    expect(member.headers.get('location')).toBe('/servers');
  });

  it('lists only servers the user manages and the bot is in', async () => {
    const { app, headers } = setup();
    const html = await (await app.request('/servers', { headers })).text();
    expect(html).toContain('Rama Lab');
    expect(html).toContain('href="/servers/20"');
    expect(html).not.toContain('Other');
  });

  it('shows usage and the settings forms for a server', async () => {
    const { app, headers, db } = setup();
    createUsageRecorder(db, { trackUsers: false }).record({
      at: new Date(),
      feature: 'moderation',
      kind: 'command',
      target: '/ban',
      guildId: '20',
      userId: null,
      outcome: 'ok',
      durationMs: 42,
    });

    const res = await app.request('/servers/20?days=7', { headers });
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('Rama Lab');
    expect(html).toContain('/ban');
    expect(html).toContain('action="/servers/20/settings/moderation"');
    expect(html).toContain('<option value="201"');
    expect(html).not.toContain('<option value="202"');
    expect(html).toContain('<option value="209"');
  });
});

describe('saving settings', () => {
  it('saves valid values and redirects back with a notice', async () => {
    const { post, stored } = setup();
    const res = await post('/servers/20/settings/moderation', {
      logChannel: '201',
      modRole: '209',
      limit: '3',
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/servers/20?saved=moderation#settings-moderation');
    expect(stored()).toEqual([
      { key: 'dmMembers', value: 'false' },
      { key: 'limit', value: '3' },
      { key: 'logChannel', value: '"201"' },
      { key: 'modRole', value: '"209"' },
    ]);
  });

  it('rejects a channel from another server and saves nothing', async () => {
    const { post, stored } = setup();
    const res = await post('/servers/20/settings/moderation', { logChannel: '401', limit: '3' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Choose a text channel in this server');
    expect(stored()).toEqual([]);
  });

  it('rejects a voice channel, a foreign role and a non-id', async () => {
    const { post, stored } = setup();
    expect((await post('/servers/20/settings/moderation', { logChannel: '202' })).status).toBe(400);
    expect((await post('/servers/20/settings/moderation', { modRole: '409' })).status).toBe(400);
    expect((await post('/servers/20/settings/moderation', { logChannel: 'abc' })).status).toBe(400);
    expect(stored()).toEqual([]);
  });

  it('shows validation errors on the form', async () => {
    const { post } = setup();
    const res = await post('/servers/20/settings/moderation', { limit: '9' });
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/Limit.*5/s);
  });

  it('answers 404 for a feature without settings', async () => {
    const { post } = setup();
    expect((await post('/servers/20/settings/general', {})).status).toBe(404);
    expect((await post('/servers/20/settings/nope', {})).status).toBe(404);
  });

  it('refuses servers the user cannot manage', async () => {
    const { post, stored } = setup();
    expect((await post('/servers/40/settings/moderation', { logChannel: '401' })).status).toBe(403);
    expect(stored()).toEqual([]);
  });
});
