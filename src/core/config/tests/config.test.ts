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
