import { SlashCommandBuilder, CommandInteraction, Collection } from 'discord.js';

export interface ICommand {
  data: SlashCommandBuilder;
  execute(interaction: CommandInteraction): Promise<void>;
}

export interface CommandCollection extends Collection<string, ICommand> {}

export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
}