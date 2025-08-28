# Rupa - Discord Bot

Rupa is a comprehensive TypeScript Discord bot with modern development practices, database integration, and robust architecture. Built with scalability and maintainability in mind.

## 🚀 Features

- **TypeScript** for type safety and better development experience
- **Discord.js v14** for Discord API integration
- **KnexJS + better-sqlite3** for database operations with migration support
- **Singleton Database Service** for centralized database management
- **Winston Logger** for comprehensive logging
- **Command Handler System** with slash commands support
- **Event Management System** for Discord events
- **Environment Configuration** management
- **Error Handling** and graceful shutdown
- **Input Validation** utilities
- **Code Quality Tools** (ESLint, Prettier)

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Discord Bot Token and Application ID

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rupa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your Discord bot credentials:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_client_id_here
   GUILD_ID=your_test_guild_id_here_optional
   DATABASE_PATH=./data/bot.db
   LOG_LEVEL=info
   NODE_ENV=development
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Deploy commands to Discord**
   ```bash
   # Deploy commands globally (takes up to 1 hour to propagate)
   npm run deploy-commands
   
   # For guild-specific deployment (instant), set GUILD_ID in .env first
   npm run deploy-commands
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## 🔧 Development

### Development Mode
Start the bot in development mode with hot reload:
```bash
npm run dev
```

### Code Quality
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Database Operations
```bash
# Run database migrations
npm run migrate
```

### Command Management
```bash
# Deploy slash commands to Discord
npm run deploy-commands

# Remove all guild-specific commands (requires GUILD_ID in .env)
npm run remove-guild-commands

# Remove all global commands
npm run remove-global-commands

# Remove both guild and global commands
npm run remove-all-commands
```

## 📁 Project Structure

```
src/
├── commands/           # Slash commands
│   ├── general/       # General purpose commands
│   ├── moderation/    # Moderation commands
│   └── index.ts       # Command registry
├── events/            # Discord event handlers
│   ├── ready.ts       # Bot ready event
│   ├── interactionCreate.ts  # Command interactions
│   └── guildEvents.ts # Guild-related events
├── services/          # Business logic services
│   ├── database/      # Database service layer
│   │   ├── DatabaseService.ts  # Singleton DB service
│   │   ├── models/    # Database models
│   │   └── migrations/# Database migrations
│   ├── logger/        # Logging service
│   ├── config/        # Configuration management
│   └── DiscordBot.ts  # Main bot service
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── index.ts           # Application entry point
```

## 📋 Command Deployment Strategy

### Global vs Guild Commands

**Global Commands:**
- Comment out or remove `GUILD_ID` in `.env`
- Commands available in all servers
- Takes up to 1 hour to propagate
- Use for production deployment

**Guild-Specific Commands:**
- Set `GUILD_ID` in `.env` to your test server ID
- Commands appear immediately in specified server
- Perfect for development and testing
- Guild commands take precedence over global commands

### Command Lifecycle Management

1. **Development**: Use guild-specific deployment for instant testing
2. **Testing**: Deploy to test server using `GUILD_ID`
3. **Production**: Remove guild commands and deploy globally
4. **Updates**: Redeploy commands when structure changes, restart bot for logic changes

### Command Removal Scenarios

- **Switch Guild to Global**: `npm run remove-guild-commands` → remove `GUILD_ID` → `npm run deploy-commands`
- **Switch Global to Guild**: `npm run remove-global-commands` → set `GUILD_ID` → `npm run deploy-commands`
- **Clean Start**: `npm run remove-all-commands` → `npm run deploy-commands`

## 🤖 Available Commands

### General Commands
- `/ping` - Check bot latency and API response time
- `/info` - Display bot information and statistics
- `/help` - Show available commands and their descriptions
- `/userinfo [user]` - Display user profile information
- `/serverinfo` - Display server information and statistics

### Moderation Commands
- `/kick <user> [reason]` - Kick a member from the server
- `/ban <user> [reason] [delete_days]` - Ban a member from the server
- `/clear <amount> [user]` - Bulk delete messages

## 🗄️ Database

The bot uses SQLite3 with KnexJS for database operations. The database includes:

- **Users Table** - Store Discord user information
- **Guilds Table** - Store server-specific settings
- **User_Guilds Table** - Junction table for user-server relationships

### Database Schema

```sql
-- Users table
CREATE TABLE users (
    id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    discriminator VARCHAR(4) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Guilds table
CREATE TABLE guilds (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    prefix VARCHAR(5) DEFAULT '!',
    settings TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User-Guild junction table
CREATE TABLE user_guilds (
    user_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    roles TEXT DEFAULT '[]',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, guild_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
```

## 📝 Logging

The bot uses Winston for comprehensive logging with multiple levels:

- **error** - Error messages and exceptions
- **warn** - Warning messages
- **info** - General information
- **debug** - Detailed debug information

Logs are output to:
- Console (with colors in development)
- Files (in production): `logs/combined.log`, `logs/error.log`

### Log Categories
- System logs (startup, shutdown, errors)
- Command execution logs
- Database operation logs
- Discord API interaction logs
- Security-related logs

## ⚙️ Configuration

Configuration is managed through environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal | - | ✅ |
| `CLIENT_ID` | Discord application client ID | - | ✅ |
| `GUILD_ID` | Test guild ID for development | - | ❌ |
| `DATABASE_PATH` | SQLite database file path | `./data/bot.db` | ❌ |
| `LOG_LEVEL` | Logging level (error/warn/info/debug) | `info` | ❌ |
| `NODE_ENV` | Environment (development/production) | `development` | ❌ |

## 🔧 Creating New Commands

1. Create a new command file in the appropriate category folder:

```typescript
// src/commands/general/example.ts
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { ICommand } from '@/types/bot';

export const exampleCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('An example command'),

  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.reply('Hello, World!');
  },
};
```

2. Export the command from the category index file:

```typescript
// src/commands/general/index.ts
export { exampleCommand } from './example';
```

3. Add the command to the main commands array:

```typescript
// src/commands/index.ts
import { exampleCommand } from './general';

export const commands: ICommand[] = [
  // ... other commands
  exampleCommand,
];
```

4. Deploy the updated commands:

```bash
# For development (instant, requires GUILD_ID in .env)
npm run deploy-commands

# For production (global, takes up to 1 hour)
# Remove or comment GUILD_ID in .env, then:
npm run deploy-commands
```

## 🎯 Adding Event Handlers

1. Create a new event handler:

```typescript
// src/events/messageCreate.ts
import { Message } from 'discord.js';
import { logger } from '@/services/logger';

export async function handleMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return;
  
  // Handle the message
  logger.info(`Message received: ${message.content}`);
}
```

2. Register the event in your bot initialization:

```typescript
// In your bot setup
client.on(Events.MessageCreate, handleMessageCreate);
```

## 🔄 Command Deployment Best Practices

### When to Redeploy Commands
- Command structure changes (name, description, options)
- Adding or removing commands
- Changing command permissions

### When to Just Restart the Bot
- Logic changes within command execution
- Response message updates
- Bug fixes that don't affect command structure

### Deployment Tips
- Use guild deployment during development for instant feedback
- Test thoroughly in guild before global deployment
- Global commands overwrite previous global commands (no duplicates)
- Guild and global commands are managed separately

## 🛡️ Error Handling

The bot includes comprehensive error handling:

- **Global error handlers** for unhandled promises and exceptions
- **Command-specific error handling** with user-friendly messages
- **Database error recovery** with connection retry logic
- **Discord API error handling** with rate limit respect
- **Graceful shutdown** on process termination

## 🧪 Testing

To test your bot:

1. Create a test Discord server
2. Invite your bot with appropriate permissions
3. Use the `GUILD_ID` environment variable for faster command deployment
4. Test commands in the server

### Required Bot Permissions

- Send Messages
- Use Slash Commands
- Embed Links
- Read Message History
- Manage Messages (for moderation commands)
- Kick Members (for kick command)
- Ban Members (for ban command)
- View Channels
- Connect (for voice features, if implemented)

### Getting Your Guild ID

1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click on your server name
3. Select "Copy Server ID"
4. Use this ID as `GUILD_ID` in your `.env` file for development

## 📦 Deployment

### Production Deployment

1. Set environment to production:
   ```env
   NODE_ENV=production
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Start with PM2 or similar process manager:
   ```bash
   pm2 start dist/index.js --name rupa-bot
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY data/ ./data/

CMD ["node", "dist/index.js"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the logs for error messages
2. Ensure all environment variables are set correctly
3. Verify bot permissions in Discord
4. Check Discord API status
5. Review the documentation

## 🎉 Getting Started Checklist

- [ ] Clone the repository
- [ ] Install dependencies (`npm install`)
- [ ] Copy and configure `.env` file with Discord credentials
- [ ] Set `GUILD_ID` in `.env` for development (optional but recommended)
- [ ] Build the project (`npm run build`)
- [ ] Run database migrations (`npm run migrate`)
- [ ] Deploy commands (`npm run deploy-commands`)
- [ ] Start the bot (`npm start` or `npm run dev`)
- [ ] Test basic commands in Discord
- [ ] Verify bot permissions in your server
- [ ] Customize commands and features as needed
- [ ] Deploy globally when ready for production

Happy coding! 🚀