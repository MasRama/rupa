import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, requireDiscordCredentials } from '../index';

describe('loadConfig', () => {
  it('applies defaults when nothing is set', () => {
    const config = loadConfig({});
    expect(config.nodeEnv).toBe('development');
    expect(config.logLevel).toBe('info');
    expect(config.databasePath).toBe('./data/rupa.db');
    expect(config.discord).toEqual({});
  });

  it('treats empty strings as unset', () => {
    const config = loadConfig({ DISCORD_GUILD_ID: '', LOG_LEVEL: '' });
    expect(config.discord.guildId).toBeUndefined();
    expect(config.logLevel).toBe('info');
  });

  it('reads Discord values', () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'token',
      DISCORD_CLIENT_ID: '123',
      DISCORD_GUILD_ID: '456',
    });
    expect(config.discord).toEqual({
      token: 'token',
      clientId: '123',
      guildId: '456',
    });
  });

  it('lists every invalid variable in one error', () => {
    let error: unknown;
    try {
      loadConfig({ LOG_LEVEL: 'loud', NODE_ENV: 'staging' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as Error).message).toContain('LOG_LEVEL');
    expect((error as Error).message).toContain('NODE_ENV');
  });
});

describe('requireDiscordCredentials', () => {
  it('names every missing credential', () => {
    expect(() => requireDiscordCredentials(loadConfig({}))).toThrow(
      /DISCORD_TOKEN.*DISCORD_CLIENT_ID/s,
    );
  });

  it('returns the credentials when present', () => {
    const config = loadConfig({ DISCORD_TOKEN: 't', DISCORD_CLIENT_ID: '123' });
    expect(requireDiscordCredentials(config)).toEqual({
      token: 't',
      clientId: '123',
    });
  });
});

describe('stats config', () => {
  it('records usage for 90 days without user ids by default', () => {
    expect(loadConfig({}).stats).toEqual({ enabled: true, retentionDays: 90, trackUsers: false });
  });

  it('reads STATS_* values', () => {
    const config = loadConfig({
      STATS_ENABLED: 'false',
      STATS_RETENTION_DAYS: '30',
      STATS_TRACK_USERS: 'true',
    });
    expect(config.stats).toEqual({ enabled: false, retentionDays: 30, trackUsers: true });
  });

  it('rejects a retention that is not a positive whole number of days', () => {
    expect(() => loadConfig({ STATS_RETENTION_DAYS: '0' })).toThrow(/STATS_RETENTION_DAYS/);
    expect(() => loadConfig({ STATS_TRACK_USERS: 'maybe' })).toThrow(/STATS_TRACK_USERS/);
  });
});

describe('dashboard config', () => {
  const dashboardEnv = {
    DASHBOARD_PORT: '3000',
    DASHBOARD_URL: 'https://bot.example.com/',
    DISCORD_CLIENT_SECRET: 'secret',
  };

  it('is off unless DASHBOARD_PORT is set', () => {
    expect(loadConfig({}).dashboard).toBeNull();
  });

  it('reads the dashboard settings, trimming the trailing slash of the URL', () => {
    const config = loadConfig({ ...dashboardEnv, DASHBOARD_OWNER_IDS: '111, 222' });
    expect(config.dashboard).toEqual({
      port: 3000,
      url: 'https://bot.example.com',
      clientSecret: 'secret',
      ownerIds: ['111', '222'],
    });
  });

  it('requires the client secret and public URL once a port is set', () => {
    expect(() => loadConfig({ DASHBOARD_PORT: '3000' })).toThrow(
      /DISCORD_CLIENT_SECRET.*DASHBOARD_URL|DASHBOARD_URL.*DISCORD_CLIENT_SECRET/s,
    );
  });

  it('rejects owner ids that are not Discord ids', () => {
    expect(() => loadConfig({ ...dashboardEnv, DASHBOARD_OWNER_IDS: 'ren' })).toThrow(
      /DASHBOARD_OWNER_IDS/,
    );
  });
});
