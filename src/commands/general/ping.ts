import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand } from '@/types/bot';

export const pingCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong! and shows bot latency'),

  async execute(interaction: CommandInteraction): Promise<void> {
    const sent = await interaction.reply({ 
      content: 'Pinging...', 
      fetchReply: true 
    });

    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(0x5865F2)
      .addFields(
        { 
          name: 'Bot Latency', 
          value: `${botLatency}ms`, 
          inline: true 
        },
        { 
          name: 'API Latency', 
          value: `${apiLatency}ms`, 
          inline: true 
        }
      )
      .setTimestamp();

    await interaction.editReply({ 
      content: '', 
      embeds: [embed] 
    });
  },
};