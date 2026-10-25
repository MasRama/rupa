import type { Child } from 'hono/jsx';
import type { SessionUser } from '@/core';

export interface LayoutProps {
  title: string;
  botName: string;
  user: SessionUser | null;
  owner?: boolean;
  current?: 'servers' | 'overview';
  children?: Child;
}

const avatarUrl = (user: SessionUser) =>
  user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';

export function Layout({ title, botName, user, owner, current, children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${title} | ${botName}`}</title>
        <link rel="stylesheet" href="/assets/rupa.css" />
        <link rel="stylesheet" href="/assets/dashboard.css" />
      </head>
      <body>
        {user && (
          <header class="topbar">
            <a class="brand" href="/servers">
              {botName}
            </a>
            <nav aria-label="Main">
              <a href="/servers" aria-current={current === 'servers' ? 'page' : undefined}>
                Servers
              </a>
              {owner && (
                <a href="/overview" aria-current={current === 'overview' ? 'page' : undefined}>
                  All servers
                </a>
              )}
            </nav>
            <div class="account">
              <img src={avatarUrl(user)} alt="" width="28" height="28" />
              <span>{user.username}</span>
              <form method="post" action="/auth/logout">
                <button type="submit" class="link">
                  Sign out
                </button>
              </form>
            </div>
          </header>
        )}
        <main class="page">{children}</main>
      </body>
    </html>
  );
}
