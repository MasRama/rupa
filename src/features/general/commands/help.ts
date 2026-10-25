import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { command } from '@/core';

export const helpCommand = command({
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List the commands this bot offers'),

  async execute(interaction, ctx) {
    const embed = new EmbedBuilder().setTitle('Commands').setColor(0x5865f2);

    // Grouped by the feature that provides them, in mount order.
    for (const feature of ctx.registry.features) {
      const slashCommands = feature.commands.filter(definition => definition.type === 'command');
      if (slashCommands.length === 0) continue;
      const lines = slashCommands.map(({ data }) => {
        const { description } = data.toJSON();
        return `\`/${data.name}\` ${description}`;
      });
      embed.addFields({ name: feature.name, value: lines.join('\n') });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});
