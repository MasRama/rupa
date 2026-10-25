# Dashboard

Rupa can serve a small web dashboard from the bot process. Server managers sign in with Discord, see how the bot is used in their servers and change feature settings. Bot owners also get an overview of every server.

It is off unless you set `DASHBOARD_PORT`.

## Turning it on

1. In the [Developer Portal](https://discord.com/developers/applications), open your application, go to **OAuth2**, copy the **Client Secret**, and add a redirect: `https://your-domain.example/auth/callback` (for local use, `http://localhost:3000/auth/callback`).
2. Add to `.env`:

   ```bash
   DASHBOARD_PORT=3000
   DASHBOARD_URL=http://localhost:3000   # the public address, no trailing slash needed
   DISCORD_CLIENT_SECRET=...
   # Optional: extra owners (comma-separated user ids) besides the application owner or team
   DASHBOARD_OWNER_IDS=
   ```

3. Start the bot and open `DASHBOARD_URL`.

In production, put it behind a reverse proxy with HTTPS (Caddy, nginx) and set `DASHBOARD_URL` to the `https://` address. Cookies are then marked `Secure`. The server listens on every interface on `DASHBOARD_PORT`, so keep the port closed to the outside and expose only the proxy. `GET /healthz` answers `{"status":"ok","discord":"ready"}` for uptime checks.

## Pages

| Path           | Who                     | What                                                                              |
| -------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `/`            | everyone                | Sign in with Discord                                                              |
| `/servers`     | signed in               | Servers you manage that the bot is in                                             |
| `/servers/:id` | managers of that server | Usage for 7, 30 or 90 days and a settings form for each feature that has settings |
| `/overview`    | bot owners              | Usage across every server                                                         |

Charts are rendered on the server, and every chart has a table view. The pages need no JavaScript.

## Security

- **Sign-in** uses Discord OAuth2 with only the `identify` and `guilds` scopes, plus a `state` cookie against forged callbacks. The Discord access token is revoked right after sign-in and never stored.
- **Sessions** last 7 days. The cookie holds a random token, and the database stores only its SHA-256 hash. Cookies are `HttpOnly` and `SameSite=Lax`.
- **Access is checked live.** Each server page asks Discord, through the bot, whether you still own the server or have Manage Server. Losing the permission takes effect on the next request. Until the bot is connected, these pages answer 503.
- **Forms** are protected against cross-site requests: every POST must come from `DASHBOARD_URL`'s origin.
- **Settings** are validated before saving, and channels and roles must belong to that server.

## Adding your own pages

A feature can add routes with a `web` hook. The app is [Hono](https://hono.dev), and pages are written in JSX (`hono/jsx`) and rendered on the server.

```tsx
// src/features/tickets/web.tsx
import { requireGuildManager, type WebApp, type WebContext } from '@/core';

export function ticketPages(app: WebApp, ctx: WebContext) {
  app.get('/servers/:guildId/tickets', requireGuildManager, c => {
    const open = ctx.db
      .prepare('SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND closed_at IS NULL')
      .get(c.req.param('guildId')) as { n: number };
    return c.html(<p>{open.n} open tickets</p>);
  });
}

// src/features/tickets/index.ts
defineFeature({ name: 'tickets', web: ticketPages /* ... */ });
```

| Guard                 | Lets through                             |
| --------------------- | ---------------------------------------- |
| `requireUser`         | anyone signed in; others are sent to `/` |
| `requireGuildManager` | managers of the `:guildId` in the path   |
| `requireOwner`        | bot owners                               |

Inside a handler, `c.var.user` is the signed-in user (`id`, `username`, `avatar`, `guildIds`). `ctx` has `db`, `logger`, `client`, `registry`, `access` and `config`. Pages can link `/assets/rupa.css` for the base styles.

The example `dashboard` feature in `src/features/dashboard` builds every page above with these same pieces. Restyle it, or drop it from `src/app/features.ts` and write your own.
