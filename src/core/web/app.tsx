import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
import { MessagePage } from './html';
import { createSessionStore, SESSION_COOKIE, SESSION_TTL_MS } from './session';
import { STYLES } from './styles';
import type { WebDeps, WebEnv } from './types';

const STATE_COOKIE = 'rupa_oauth_state';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * The dashboard's HTTP app: health check, Discord sign-in, sessions, CSRF
 * protection, and every feature's `web` hook. Start it with `startWebServer`.
 */
export function createWebApp(deps: WebDeps): Hono<WebEnv> {
  const { config, oauth, access, logger } = deps;
  const sessions = createSessionStore(deps.db);
  const origin = new URL(config.url).origin;
  const secure = config.url.startsWith('https://');
  const app = new Hono<WebEnv>();

  app.use(secureHeaders());

  // Browsers send Origin with every form POST; anything else is cross-site or forged.
  app.use(async (c, next) => {
    if (UNSAFE_METHODS.has(c.req.method)) {
      const sent = c.req.header('origin') ?? originOf(c.req.header('referer'));
      if (sent !== origin) return c.text('Cross-site request blocked', 403);
    }
    return next();
  });

  app.use(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    c.set('user', token ? sessions.find(token) : null);
    c.set('access', access);
    await next();
  });

  app.get('/healthz', c =>
    c.json({ status: 'ok', discord: access.ready() ? 'ready' : 'connecting' }),
  );
  app.get('/assets/rupa.css', c =>
    c.body(STYLES, 200, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    }),
  );

  app.get('/auth/login', c => {
    const state = randomBytes(24).toString('base64url');
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/auth',
      maxAge: 600,
    });
    return c.redirect(oauth.authorizeUrl(state), 302);
  });

  app.get('/auth/callback', async c => {
    const { code, state } = c.req.query();
    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: '/auth' });
    if (!code || !state || !expected || state !== expected) {
      return c.html(
        <MessagePage title="Sign-in expired">
          <p>That sign-in link is no longer valid. Please sign in again.</p>
        </MessagePage>,
        400,
      );
    }

    let user;
    try {
      user = await oauth.exchange(code);
    } catch (error) {
      logger.warn({ err: error }, 'Discord sign-in failed');
      return c.html(
        <MessagePage title="Sign-in failed">
          <p>Discord did not accept the sign-in. Please try again.</p>
        </MessagePage>,
        502,
      );
    }

    setCookie(c, SESSION_COOKIE, sessions.create(user), {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });
    logger.info({ userId: user.id }, 'Dashboard sign-in');
    return c.redirect('/servers', 302);
  });

  app.post('/auth/logout', c => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) sessions.destroy(token);
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure });
    return c.redirect('/', 302);
  });

  for (const feature of deps.registry.features) {
    feature.web?.(app, {
      feature: feature.name,
      db: deps.db,
      logger: logger.child({ feature: feature.name }),
      client: deps.client,
      registry: deps.registry,
      access,
      config,
    });
  }

  app.notFound(c =>
    c.html(
      <MessagePage title="Page not found">
        <p>There is nothing at this address.</p>
      </MessagePage>,
      404,
    ),
  );
  app.onError((error, c) => {
    logger.error({ err: error, path: c.req.path }, 'Dashboard request failed');
    return c.html(
      <MessagePage title="Something went wrong">
        <p>The error has been logged.</p>
      </MessagePage>,
      500,
    );
  });

  return app;
}
