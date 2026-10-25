import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type APIEmbedField } from 'discord.js';
import { command, type FeatureRegistry } from '@/core';

/** Slash commands grouped by the feature that provides them, then right-click menus. */
export function helpFields(registry: FeatureRegistry): APIEmbedField[] {
  const fields: APIEmbedField[] = [];
  for (const feature of registry.features) {
    const lines = feature.commands.flatMap(definition => {
      if (definition.type !== 'command') return [];
      return [`\`/${definition.data.name}\` ${definition.data.toJSON().description}`];
    });
    if (lines.length > 0) fields.push({ name: feature.name, value: lines.join('\n') });
  }
  if (registry.menus.length > 0) {
    const menus = registry.menus.map(({ definition }) => {
      const on = definition.type === 'user-command' ? 'a user' : 'a message';
      return `**${definition.data.name}** on ${on}`;
    });
    fields.push({ name: 'Right-click menus', value: menus.join('\n') });
  }
  return fields;
}

export const helpCommand = command({
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List the commands this bot offers'),

  async execute(interaction, ctx) {
    const embed = new EmbedBuilder()
      .setTitle('Commands')
      .setColor(0x5865f2)
      .addFields(helpFields(ctx.registry));
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});
