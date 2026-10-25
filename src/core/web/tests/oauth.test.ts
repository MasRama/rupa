import { describe, expect, it, vi } from 'vitest';
import { createDiscordOAuth } from '../oauth';

function fakeDiscord() {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).replace('https://discord.com/api/v10', '');
    calls.push({ url: path, init });
    const body: Record<string, unknown> = {
      '/oauth2/token': { access_token: 'tok' },
      '/users/@me': { id: '10', username: 'ren', avatar: 'abc' },
      '/users/@me/guilds': [
        { id: '1', owner: true, permissions: '0' },
        { id: '2', owner: false, permissions: String(0x20) },
        { id: '3', owner: false, permissions: String(0x8) },
        { id: '4', owner: false, permissions: String(0x400) },
      ],
      '/oauth2/token/revoke': {},
    };
    return new Response(JSON.stringify(body[path]), { status: 200 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const options = {
  clientId: '99',
  clientSecret: 'shh',
  redirectUri: 'https://bot.example.com/auth/callback',
};

describe('Discord OAuth', () => {
  it('asks only for identify and guilds, carrying the state', () => {
    const url = new URL(createDiscordOAuth(options).authorizeUrl('xyz'));
    expect(url.searchParams.get('scope')).toBe('identify guilds');
    expect(url.searchParams.get('state')).toBe('xyz');
    expect(url.searchParams.get('redirect_uri')).toBe(options.redirectUri);
  });

  it('keeps the servers the user owns or can manage, then revokes the token', async () => {
    const discord = fakeDiscord();
    const user = await createDiscordOAuth({ ...options, fetch: discord.fetch }).exchange('code');

    expect(user).toEqual({ id: '10', username: 'ren', avatar: 'abc', guildIds: ['1', '2', '3'] });
    expect(discord.calls.at(-1)?.url).toBe('/oauth2/token/revoke');
  });
});
