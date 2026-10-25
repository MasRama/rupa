import { existsSync } from 'node:fs';
import { z } from 'zod';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: LogLevel;
  databasePath: string;
  discord: {
    token?: string;
    clientId?: string;
    guildId?: string;
  };
}

export interface DiscordCredentials {
  token: string;
  clientId: string;
  guildId?: string;
}

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map(issue => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

// Empty strings come from `KEY=` lines in .env files; treat them as unset.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(value => (value === '' ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: optional(z.enum(['development', 'production', 'test'])),
  LOG_LEVEL: optional(z.enum(LOG_LEVELS)),
  DATABASE_PATH: optional(z.string()),
  DISCORD_TOKEN: optional(z.string()),
  DISCORD_CLIENT_ID: optional(z.string().regex(/^\d+$/, 'must be a numeric Discord id')),
  DISCORD_GUILD_ID: optional(z.string().regex(/^\d+$/, 'must be a numeric Discord id')),
});

/** Reads and validates the environment. Pure: pass `process.env` explicitly. */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
    );
  }

  const values = parsed.data;
  const discord: AppConfig['discord'] = {};
  if (values.DISCORD_TOKEN) discord.token = values.DISCORD_TOKEN;
  if (values.DISCORD_CLIENT_ID) discord.clientId = values.DISCORD_CLIENT_ID;
  if (values.DISCORD_GUILD_ID) discord.guildId = values.DISCORD_GUILD_ID;

  return {
    nodeEnv: values.NODE_ENV ?? 'development',
    logLevel: values.LOG_LEVEL ?? 'info',
    databasePath: values.DATABASE_PATH ?? './data/rupa.db',
    discord,
  };
}

/** For code paths that talk to Discord: fails with every missing variable. */
export function requireDiscordCredentials(config: AppConfig): DiscordCredentials {
  const { token, clientId, guildId } = config.discord;
  const missing: string[] = [];
  if (!token) missing.push('DISCORD_TOKEN: required');
  if (!clientId) missing.push('DISCORD_CLIENT_ID: required');
  if (!token || !clientId) throw new ConfigError(missing);

  return guildId ? { token, clientId, guildId } : { token, clientId };
}

/** Loads `.env` into `process.env` when the file exists (Node's built-in loader). */
export function loadEnvFile(path = '.env'): void {
  if (existsSync(path)) process.loadEnvFile(path);
}
