import { createHash } from 'node:crypto';
import type { Client } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { defineFeature } from '@/core/feature';
import { createRegistry } from '@/core/routing/registry';
import { stubLogger } from '@/core/routing/tests/fixtures';
import { coreSchema } from '@/core/schema';
import {
  createSessionStore,
  createWebApp,
  requireGuildManager,
  requireOwner,
  requireUser,
  type GuildAccess,
  type OAuthClient,
  type WebContext,
} from '../index';

const URL_BASE = 'https://bot.example.com';
const ORIGIN = { Origin: URL_BASE };

function setup(options: { manage?: boolean; owner?: boolean; ready?: boolean } = {}) {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema]);
  const state = {
    manage: options.manage ?? true,
    owner: options.owner ?? false,
    ready: options.ready ?? true,
  };

  const oauth: OAuthClient = {
    authorizeUrl: stateValue => `https://discord.test/authorize?state=${stateValue}`,
    exchange: vi.fn(async (code: string) => {
      if (code !== 'good') throw new Error('invalid_grant');
      return { id: '10', username: 'ren', avatar: null, guildIds: ['20'] };
    }),
  };
  const access: GuildAccess = {
    ready: () => state.ready,
    canManage: vi.fn(async (_userId: string, guildId: string) => state.manage && guildId === '20'),
    isOwner: async () => state.owner,
  };

  let received: WebContext | null = null;
  const feature = defineFeature({
    name: 'pages',
    web(app, ctx) {
      received = ctx;
      app.get('/me', requireUser, c => c.text(`hello ${c.var.user!.username}`));
      app.get('/servers/:guildId', requireGuildManager, c =>
        c.text(`manage ${c.req.param('guildId')}`),
      );
      app.post('/servers/:guildId', requireGuildManager, c => c.text('saved'));
      app.get('/overview', requireOwner, c => c.text('owner'));
    },
  });

  const app = createWebApp({
    registry: createRegistry([feature]),
    db,
    logger: stubLogger(),
    client: {} as Client,
    config: { port: 3000, url: URL_BASE, clientSecret: 's', ownerIds: [] },
    oauth,
    access,
  });
  const sessions = createSessionStore(db);
  const login = () =>
    sessions.create({ id: '10', username: 'ren', avatar: null, guildIds: ['20'] });
  const cookie = (token: string) => ({ Cookie: `rupa_session=${token}` });

  return { app, db, state, oauth, access, sessions, login, cookie, received: () => received };
}

describe('web app', () => {
  it('answers health checks', async () => {
    const { app } = setup();
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', discord: 'ready' });
  });

  it('gives features a context with their name', () => {
    const { received } = setup();
    expect(received()).toMatchObject({ feature: 'pages' });
  });
});

describe('login', () => {
  it('redirects to Discord with a state that is also set as a cookie', async () => {
    const { app } = setup();
    const res = await app.request('/auth/login');
    expect(res.status).toBe(302);
    const state = new URL(res.headers.get('location')!).searchParams.get('state');
    expect(state).toMatch(/^[\w-]{20,}$/);
    expect(res.headers.get('set-cookie')).toContain(`rupa_oauth_state=${state}`);
  });

  it('rejects a callback whose state does not match the cookie', async () => {
    const { app, oauth, db } = setup();
    const res = await app.request('/auth/callback?code=good&state=forged', {
      headers: { Cookie: 'rupa_oauth_state=real' },
    });
    expect(res.status).toBe(400);
    expect(oauth.exchange).not.toHaveBeenCalled();
    expect(db.prepare('SELECT COUNT(*) AS n FROM rupa_sessions').get()).toEqual({ n: 0 });
  });

  it('creates a secure session cookie and stores only its hash', async () => {
    const { app, db } = setup();
    const res = await app.request('/auth/callback?code=good&state=abc', {
      headers: { Cookie: 'rupa_oauth_state=abc' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/servers');

    const setCookie = res.headers.getSetCookie().find(value => value.startsWith('rupa_session='))!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Secure/i);
    const token = setCookie.split(';')[0]!.split('=')[1]!;

    const row = db.prepare('SELECT id_hash, user_id FROM rupa_sessions').get() as {
      id_hash: string;
      user_id: string;
    };
    expect(row.user_id).toBe('10');
    expect(row.id_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(row.id_hash).not.toBe(token);
  });

  it('shows an error when Discord refuses the code', async () => {
    const { app } = setup();
    const res = await app.request('/auth/callback?code=bad&state=abc', {
      headers: { Cookie: 'rupa_oauth_state=abc' },
    });
    expect(res.status).toBe(502);
  });

  it('logs out by deleting the session and clearing the cookie', async () => {
    const { app, login, cookie, sessions } = setup();
    const token = login();
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { ...cookie(token), ...ORIGIN },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('set-cookie')).toMatch(/rupa_session=;/);
    expect(sessions.find(token)).toBeNull();
  });

  it('treats an expired session as logged out', async () => {
    const { app, db, login, cookie } = setup();
    const token = login();
    db.prepare('UPDATE rupa_sessions SET expires_at = ?').run('2000-01-01T00:00:00.000Z');
    const res = await app.request('/me', { headers: cookie(token) });
    expect(res.status).toBe(302);
  });
});

describe('guards', () => {
  it('sends visitors without a session to the login page', async () => {
    const { app } = setup();
    const res = await app.request('/me');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
  });

  it('lets a signed-in user through', async () => {
    const { app, login, cookie } = setup();
    const res = await app.request('/me', { headers: cookie(login()) });
    expect(await res.text()).toBe('hello ren');
  });

  it('answers 503 until the bot is connected', async () => {
    const { app, login, cookie } = setup({ ready: false });
    const res = await app.request('/servers/20', { headers: cookie(login()) });
    expect(res.status).toBe(503);
  });

  it('allows a server manager and checks again on every request', async () => {
    const { app, login, cookie, state } = setup();
    const token = login();
    expect((await app.request('/servers/20', { headers: cookie(token) })).status).toBe(200);

    state.manage = false;
    expect((await app.request('/servers/20', { headers: cookie(token) })).status).toBe(403);
  });

  it('forbids servers the user cannot manage', async () => {
    const { app, login, cookie } = setup();
    const res = await app.request('/servers/99', { headers: cookie(login()) });
    expect(res.status).toBe(403);
  });

  it('limits owner pages to bot owners', async () => {
    const owner = setup({ owner: true });
    const other = setup({ owner: false });
    expect(
      (await owner.app.request('/overview', { headers: owner.cookie(owner.login()) })).status,
    ).toBe(200);
    expect(
      (await other.app.request('/overview', { headers: other.cookie(other.login()) })).status,
    ).toBe(403);
  });
});

describe('cross-site request protection', () => {
  it('rejects a POST from another origin', async () => {
    const { app, login, cookie } = setup();
    const res = await app.request('/servers/20', {
      method: 'POST',
      headers: { ...cookie(login()), Origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects a POST with no origin at all', async () => {
    const { app, login, cookie } = setup();
    const res = await app.request('/servers/20', { method: 'POST', headers: cookie(login()) });
    expect(res.status).toBe(403);
  });

  it('accepts a POST from the dashboard itself', async () => {
    const { app, login, cookie } = setup();
    const res = await app.request('/servers/20', {
      method: 'POST',
      headers: { ...cookie(login()), ...ORIGIN },
    });
    expect(await res.text()).toBe('saved');
  });
});
