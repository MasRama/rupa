import { createMiddleware } from 'hono/factory';
import { MessagePage } from './html';
import type { WebEnv } from './types';

const notReady = (
  <MessagePage title="Starting up">
    <p>The bot is still connecting to Discord. Try again in a few seconds.</p>
  </MessagePage>
);
const forbidden = (
  <MessagePage title="No access">
    <p>You need the Manage Server permission there, and the bot must be in that server.</p>
  </MessagePage>
);

/** Signed-in users only; everyone else goes to the sign-in page. */
export const requireUser = createMiddleware<WebEnv>(async (c, next) => {
  if (!c.var.user) return c.redirect('/', 302);
  return next();
});

/** The `:guildId` route param must be a server the user can manage right now. */
export const requireGuildManager = createMiddleware<WebEnv>(async (c, next) => {
  const { user, access } = c.var;
  if (!user) return c.redirect('/', 302);
  if (!access.ready()) return c.html(notReady, 503);
  const guildId = c.req.param('guildId');
  if (!guildId || !(await access.canManage(user.id, guildId))) return c.html(forbidden, 403);
  return next();
});

/** Bot owners only: the application owner or team, or DASHBOARD_OWNER_IDS. */
export const requireOwner = createMiddleware<WebEnv>(async (c, next) => {
  const { user, access } = c.var;
  if (!user) return c.redirect('/', 302);
  if (!access.ready()) return c.html(notReady, 503);
  if (!(await access.isOwner(user.id))) return c.html(forbidden, 403);
  return next();
});
