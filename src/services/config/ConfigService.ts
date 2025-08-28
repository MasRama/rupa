import dotenv from 'dotenv';
import { logger } from '@/services/logger';

export interface AppConfig {
  // Discord configuration
  discordToken: string;
  clientId: string;
  guildId?: string;
  
  // Database configuration
  databasePath: string;
  
  // Logging configuration
  logLevel: string;
  enableFileLogging: boolean;
  
  // Environment
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  
  // Bot configuration
  defaultPrefix: string;
}

export class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;

  private constructor() {
    // Load environment variables
    dotenv.config();
    
    // Validate and build configuration
    this.config = this.buildConfig();
    this.validateConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private buildConfig(): AppConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    return {
      // Discord configuration
      discordToken: process.env.DISCORD_TOKEN || '',
      clientId: process.env.CLIENT_ID || '',
      guildId: process.env.GUILD_ID,
      
      // Database configuration
      databasePath: process.env.DATABASE_PATH || './data/bot.db',
      
      // Logging configuration
      logLevel: process.env.LOG_LEVEL || 'info',
      enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true' || nodeEnv === 'production',
      
      // Environment
      nodeEnv,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
      
      // Bot configuration
      defaultPrefix: process.env.DEFAULT_PREFIX || '!',
    };
  }

  private validateConfig(): void {
    const errors: string[] = [];

    // Required Discord configuration
    if (!this.config.discordToken) {
      errors.push('DISCORD_TOKEN is required');
    }

    if (!this.config.clientId) {
      errors.push('CLIENT_ID is required');
    }

    // Validate log level
    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(this.config.logLevel)) {
      errors.push(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`);
    }

    // Validate node environment
    const validEnvs = ['development', 'production', 'test'];
    if (!validEnvs.includes(this.config.nodeEnv)) {
      errors.push(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    logger.info('Configuration validated successfully', {
      nodeEnv: this.config.nodeEnv,
      logLevel: this.config.logLevel,
      databasePath: this.config.databasePath,
      enableFileLogging: this.config.enableFileLogging,
    });
  }

  // Getter methods for configuration values
  public get discordToken(): string {
    return this.config.discordToken;
  }

  public get clientId(): string {
    return this.config.clientId;
  }

  public get guildId(): string | undefined {
    return this.config.guildId;
  }

  public get databasePath(): string {
    return this.config.databasePath;
  }

  public get logLevel(): string {
    return this.config.logLevel;
  }

  public get enableFileLogging(): boolean {
    return this.config.enableFileLogging;
  }

  public get nodeEnv(): string {
    return this.config.nodeEnv;
  }

  public get isDevelopment(): boolean {
    return this.config.isDevelopment;
  }

  public get isProduction(): boolean {
    return this.config.isProduction;
  }

  public get defaultPrefix(): string {
    return this.config.defaultPrefix;
  }

  // Get the entire configuration object (read-only)
  public getConfig(): Readonly<AppConfig> {
    return { ...this.config };
  }

  // Environment-specific helpers
  public isTestEnvironment(): boolean {
    return this.config.nodeEnv === 'test';
  }

  public getDiscordConfig() {
    return {
      token: this.config.discordToken,
      clientId: this.config.clientId,
      guildId: this.config.guildId,
    };
  }

  public getDatabaseConfig() {
    return {
      path: this.config.databasePath,
    };
  }

  public getLoggerConfig() {
    return {
      level: this.config.logLevel,
      enableFileLogging: this.config.enableFileLogging,
    };
  }

  // Configuration update method (use with caution)
  public updateConfig(updates: Partial<AppConfig>): void {
    logger.warn('Configuration being updated at runtime', { updates });
    this.config = { ...this.config, ...updates };
    this.validateConfig();
  }
}