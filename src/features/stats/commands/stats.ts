import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { command, createUsageQueries, usageWindow } from '@/core';
import { statsEmbed } from '../embed';

export const statsCommand = command({
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show how the bot is used in this server')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('period')
        .setDescription('How far back to look (default: 7 days)')
        .addChoices({ name: 'Last 7 days', value: '7d' }, { name: 'Last 30 days', value: '30d' }),
    ),

  async execute(interaction, ctx) {
    if (!interaction.inGuild()) return;
    const days = interaction.options.getString('period') === '30d' ? 30 : 7;
    const range = { ...usageWindow(days), guildId: interaction.guildId };
    const queries = createUsageQueries(ctx.db);

    const embed = statsEmbed({
      days,
      summary: queries.summary(range),
      daily: queries.daily(range),
      targets: queries.byTarget(range, 10),
    });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});
