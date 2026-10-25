import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { command } from '@/core';

export const pingCommand = command({
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check that the bot responds, and how fast'),

  async execute(interaction) {
    const response = await interaction.reply({ content: 'Pinging…', withResponse: true });
    const sentAt = response.resource?.message?.createdTimestamp ?? Date.now();

    const embed = new EmbedBuilder()
      .setTitle('Pong!')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Round trip', value: `${sentAt - interaction.createdTimestamp} ms`, inline: true },
        { name: 'Gateway', value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true },
      );
    await interaction.editReply({ content: '', embeds: [embed] });
  },
});
