import type { Client } from 'discord.js';
import type { Hono } from 'hono';
import type { DashboardConfig } from '@/core/config';
import type { Database } from '@/core/database';
import type { Logger } from '@/core/logging';
import type { FeatureRegistry } from '@/core/routing/registry';

/** The signed-in Discord user, as stored in their session. */
export interface SessionUser {
  id: string;
  username: string;
  avatar: string | null;
  /** Servers where Discord said, at login, that the user can manage the server. */
  guildIds: string[];
}

/** Talks to Discord's OAuth2 endpoints. Injected so tests run without Discord. */
export interface OAuthClient {
  authorizeUrl(state: string): string;
  /** Trades the callback code for the user; the access token is not kept. */
  exchange(code: string): Promise<SessionUser>;
}

/** Live permission checks against the bot's own view of Discord. */
export interface GuildAccess {
  /** False until the bot's client is connected. */
  ready(): boolean;
  /** The bot is in the server and the user owns it or has Manage Server. */
  canManage(userId: string, guildId: string): Promise<boolean>;
  /** Application owner, team member, or listed in DASHBOARD_OWNER_IDS. */
  isOwner(userId: string): Promise<boolean>;
}

export interface WebEnv {
  Variables: {
    user: SessionUser | null;
    access: GuildAccess;
  };
}

export type WebApp = Hono<WebEnv>;

export interface WebDeps {
  registry: FeatureRegistry;
  db: Database;
  logger: Logger;
  client: Client;
  config: DashboardConfig;
  oauth: OAuthClient;
  access: GuildAccess;
}

/** What a feature's `web` hook gets besides the app. */
export interface WebContext {
  feature: string;
  db: Database;
  logger: Logger;
  client: Client;
  registry: FeatureRegistry;
  access: GuildAccess;
  config: DashboardConfig;
}

export type WebHook = (app: WebApp, ctx: WebContext) => void;
