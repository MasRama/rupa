import type { OAuthClient, SessionUser } from './types';

const API = 'https://discord.com/api/v10';
// Manage Server (0x20) or Administrator (0x8).
const MANAGE = 0x20n | 0x8n;

interface DiscordGuild {
  id: string;
  owner: boolean;
  permissions: string;
}

export interface DiscordOAuthOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetch?: typeof fetch;
}

/** OAuth2 with the `identify guilds` scopes. The token is revoked right after use. */
export function createDiscordOAuth(options: DiscordOAuthOptions): OAuthClient {
  const request = options.fetch ?? fetch;
  const basic = Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64');

  const call = async <T>(path: string, init: RequestInit): Promise<T> => {
    const res = await request(`${API}${path}`, init);
    if (!res.ok) throw new Error(`Discord ${path} answered ${res.status}`);
    return (await res.json()) as T;
  };

  return {
    authorizeUrl(state) {
      const params = new URLSearchParams({
        client_id: options.clientId,
        response_type: 'code',
        redirect_uri: options.redirectUri,
        scope: 'identify guilds',
        state,
        prompt: 'none',
      });
      return `https://discord.com/oauth2/authorize?${params}`;
    },

    async exchange(code) {
      const form = { Authorization: `Basic ${basic}` };
      const token = await call<{ access_token: string }>('/oauth2/token', {
        method: 'POST',
        headers: form,
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: options.redirectUri,
        }),
      });
      const bearer = { Authorization: `Bearer ${token.access_token}` };
      try {
        const user = await call<{ id: string; username: string; avatar: string | null }>(
          '/users/@me',
          { headers: bearer },
        );
        const guilds = await call<DiscordGuild[]>('/users/@me/guilds', { headers: bearer });
        const session: SessionUser = {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          guildIds: guilds
            .filter(guild => guild.owner || (BigInt(guild.permissions) & MANAGE) !== 0n)
            .map(guild => guild.id),
        };
        return session;
      } finally {
        await request(`${API}/oauth2/token/revoke`, {
          method: 'POST',
          headers: form,
          body: new URLSearchParams({ token: token.access_token, token_type_hint: 'access_token' }),
        }).catch(() => undefined);
      }
    },
  };
}
