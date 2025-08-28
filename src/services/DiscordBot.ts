import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { ICommand } from '@/types/bot';
import { logger } from '@/services/logger';
import { config } from '@/services/config';
import { DatabaseService } from '@/services/database/DatabaseService';

export class DiscordBot {
  private static instance: DiscordBot;
  private client: Client;
  private commands: Collection<string, ICommand>;
  private isReady = false;

  private constructor() {
    // Initialize Discord client with necessary intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.commands = new Collection();
    this.setupEventListeners();
  }

  public static getInstance(): DiscordBot {
    if (!DiscordBot.instance) {
      DiscordBot.instance = new DiscordBot();
    }
    return DiscordBot.instance;
  }

  private setupEventListeners(): void {
    // Bot ready event
    this.client.once(Events.ClientReady, async (readyClient) => {
      logger.logStartup(`Bot is ready! Logged in as ${readyClient.user.tag}`);
      logger.info(`Bot is serving ${readyClient.guilds.cache.size} guilds`);
      
      this.isReady = true;
      
      // Initialize database
      try {
        const db = DatabaseService.getInstance();
        await db.initialize(config.databasePath);
        await db.createTables();
        logger.info('Database initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize database', error);
      }
    });

    // Interaction (slash command) handling
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`, {
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
        return;
      }

      try {
        logger.logCommand(
          interaction.commandName,
          interaction.user.id,
          interaction.guildId || undefined
        );

        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}`, error);

        const errorMessage = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });

    // Guild join event
    this.client.on(Events.GuildCreate, async (guild) => {
      logger.logEvent('Guild joined', {
        guildId: guild.id,
        guildName: guild.name,
        memberCount: guild.memberCount,
      });

      // Add guild to database
      try {
        const db = DatabaseService.getInstance();
        await db.createOrUpdateGuild(guild.id, guild.name);
        logger.logDatabase('create', 'guilds', guild.id);
      } catch (error) {
        logger.error('Failed to add guild to database', error);
      }
    });

    // Guild leave event
    this.client.on(Events.GuildDelete, async (guild) => {
      logger.logEvent('Guild left', {
        guildId: guild.id,
        guildName: guild.name,
      });
    });

    // Member join event
    this.client.on(Events.GuildMemberAdd, async (member) => {
      logger.logEvent('Member joined', {
        userId: member.id,
        username: member.user.username,
        guildId: member.guild.id,
      });

      // Add user to database
      try {
        const db = DatabaseService.getInstance();
        await db.createOrUpdateUser(
          member.id,
          member.user.username,
          member.user.discriminator
        );
        logger.logDatabase('create', 'users', member.id);
      } catch (error) {
        logger.error('Failed to add user to database', error);
      }
    });

    // Error handling
    this.client.on(Events.Error, (error) => {
      logger.error('Discord client error', error);
    });

    this.client.on(Events.Warn, (warning) => {
      logger.warn('Discord client warning', { warning });
    });

    // Graceful shutdown handling
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  public async start(): Promise<void> {
    try {
      logger.logStartup('Starting Discord bot...');
      await this.client.login(config.discordToken);
    } catch (error) {
      logger.error('Failed to start Discord bot', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    logger.logShutdown('Shutting down Discord bot...');

    try {
      // Close database connection
      const db = DatabaseService.getInstance();
      await db.close();
      logger.info('Database connection closed');

      // Destroy Discord client
      if (this.client) {
        this.client.destroy();
        logger.info('Discord client destroyed');
      }

      // Close logger
      await logger.close();

      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Command management
  public addCommand(command: ICommand): void {
    this.commands.set(command.data.name, command);
    logger.debug(`Command registered: ${command.data.name}`);
  }

  public removeCommand(commandName: string): boolean {
    const removed = this.commands.delete(commandName);
    if (removed) {
      logger.debug(`Command unregistered: ${commandName}`);
    }
    return removed;
  }

  public getCommand(commandName: string): ICommand | undefined {
    return this.commands.get(commandName);
  }

  public getAllCommands(): Collection<string, ICommand> {
    return this.commands;
  }

  // Getters
  public getClient(): Client {
    return this.client;
  }

  public isClientReady(): boolean {
    return this.isReady;
  }

  public getGuildCount(): number {
    return this.client.guilds.cache.size;
  }

  public getUserCount(): number {
    return this.client.users.cache.size;
  }

  // Utility methods
  public async waitForReady(timeout = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isReady) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error('Bot ready timeout'));
      }, timeout);

      this.client.once(Events.ClientReady, () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}