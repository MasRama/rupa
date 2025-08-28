import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand } from '@/types/bot';
import { DiscordBot } from '@/services/DiscordBot';

export const helpCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all available commands')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Get detailed help for a specific command')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }
    
    const commandName = interaction.options.getString('command');
    const bot = DiscordBot.getInstance();
    const commands = bot.getAllCommands();

    if (commandName) {
      // Show help for specific command
      const command = commands.get(commandName);
      
      if (!command) {
        await interaction.reply({
          content: `❌ Command \`${commandName}\` not found.`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📖 Help: /${command.data.name}`)
        .setColor(0x5865F2)
        .setDescription(command.data.description)
        .addFields({
          name: 'Usage',
          value: `\`/${command.data.name}\``,
        });

      // Add options if they exist
      if (command.data.options && command.data.options.length > 0) {
        const optionsText = command.data.options
          .map((option: any) => {
            const required = option.required ? '(required)' : '(optional)';
            return `\`${option.name}\` ${required} - ${option.description}`;
          })
          .join('\n');

        embed.addFields({
          name: 'Options',
          value: optionsText,
        });
      }

      await interaction.reply({ embeds: [embed] });
    } else {
      // Show all commands
      const generalCommands: string[] = [];
      const moderationCommands: string[] = [];

      commands.forEach((command) => {
        const commandText = `\`/${command.data.name}\` - ${command.data.description}`;
        
        // Categorize commands (you can expand this logic)
        if (['kick', 'ban', 'timeout', 'clear', 'warn'].includes(command.data.name)) {
          moderationCommands.push(commandText);
        } else {
          generalCommands.push(commandText);
        }
      });

      const embed = new EmbedBuilder()
        .setTitle('📚 Available Commands')
        .setColor(0x5865F2)
        .setDescription('Here are all the available commands. Use `/help <command>` for detailed information about a specific command.');

      if (generalCommands.length > 0) {
        embed.addFields({
          name: '🔧 General Commands',
          value: generalCommands.join('\n'),
        });
      }

      if (moderationCommands.length > 0) {
        embed.addFields({
          name: '🛡️ Moderation Commands',
          value: moderationCommands.join('\n'),
        });
      }

      embed.setFooter({
        text: `Total commands: ${commands.size}`,
      });

      await interaction.reply({ embeds: [embed] });
    }
  },
};