import knex, { Knex } from 'knex';
import { DatabaseConfig } from '@/types/database';
import path from 'path';

export class DatabaseService {
  private static instance: DatabaseService;
  private knexInstance!: Knex; // Using definite assignment assertion since it's initialized in initialize()
  private isInitialized = false;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(databasePath?: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const dbPath = databasePath || process.env.DATABASE_PATH || './data/bot.db';
    
    // Ensure the directory exists
    const fs = await import('fs');
    const dirname = path.dirname(dbPath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }

    const config: DatabaseConfig = {
      client: 'better-sqlite3',
      connection: {
        filename: dbPath,
      },
      useNullAsDefault: true,
      migrations: {
        directory: path.join(__dirname, 'migrations'),
      },
    };

    this.knexInstance = knex(config);
    this.isInitialized = true;

    // Run migrations on initialization
    await this.runMigrations();
  }

  public getConnection(): Knex {
    if (!this.isInitialized || !this.knexInstance) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.knexInstance;
  }

  public async runMigrations(): Promise<void> {
    if (!this.knexInstance) {
      throw new Error('Database not initialized');
    }

    try {
      await this.knexInstance.migrate.latest();
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Error running migrations:', error);
      throw error;
    }
  }

  public async createTables(): Promise<void> {
    const db = this.getConnection();

    // Create users table
    const usersExists = await db.schema.hasTable('users');
    if (!usersExists) {
      await db.schema.createTable('users', (table) => {
        table.string('id', 20).primary();
        table.string('username', 32).notNullable();
        table.string('discriminator', 4).notNullable();
        table.datetime('created_at').defaultTo(db.fn.now());
        table.datetime('updated_at').defaultTo(db.fn.now());
      });
    }

    // Create guilds table
    const guildsExists = await db.schema.hasTable('guilds');
    if (!guildsExists) {
      await db.schema.createTable('guilds', (table) => {
        table.string('id', 20).primary();
        table.string('name', 100).notNullable();
        table.string('prefix', 5).defaultTo('!');
        table.text('settings').defaultTo('{}');
        table.datetime('created_at').defaultTo(db.fn.now());
        table.datetime('updated_at').defaultTo(db.fn.now());
      });
    }

    // Create user_guilds junction table
    const userGuildsExists = await db.schema.hasTable('user_guilds');
    if (!userGuildsExists) {
      await db.schema.createTable('user_guilds', (table) => {
        table.string('user_id', 20).notNullable();
        table.string('guild_id', 20).notNullable();
        table.text('roles').defaultTo('[]');
        table.datetime('joined_at').defaultTo(db.fn.now());
        
        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
        table.foreign('guild_id').references('id').inTable('guilds').onDelete('CASCADE');
        table.primary(['user_id', 'guild_id']);
      });
    }
  }

  public async close(): Promise<void> {
    if (this.knexInstance) {
      await this.knexInstance.destroy();
      this.isInitialized = false;
    }
  }

  // Utility methods for common database operations
  public async getUser(userId: string) {
    const db = this.getConnection();
    return await db('users').where('id', userId).first();
  }

  public async createOrUpdateUser(userId: string, username: string, discriminator: string) {
    const db = this.getConnection();
    const user = await this.getUser(userId);
    
    if (user) {
      return await db('users')
        .where('id', userId)
        .update({
          username,
          discriminator,
          updated_at: new Date(),
        });
    } else {
      return await db('users').insert({
        id: userId,
        username,
        discriminator,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  public async getGuild(guildId: string) {
    const db = this.getConnection();
    return await db('guilds').where('id', guildId).first();
  }

  public async createOrUpdateGuild(guildId: string, name: string, settings: object = {}) {
    const db = this.getConnection();
    const guild = await this.getGuild(guildId);
    
    if (guild) {
      return await db('guilds')
        .where('id', guildId)
        .update({
          name,
          settings: JSON.stringify(settings),
          updated_at: new Date(),
        });
    } else {
      return await db('guilds').insert({
        id: guildId,
        name,
        settings: JSON.stringify(settings),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }
}