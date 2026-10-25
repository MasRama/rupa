import { EmbedBuilder, SlashCommandBuilder, version as discordJsVersion } from 'discord.js';
import { command } from '@/core';
import { formatDuration } from '../format';

export const infoCommand = command({
  data: new SlashCommandBuilder().setName('info').setDescription('Show bot statistics'),

  async execute(interaction, ctx) {
    const { client } = interaction;
    const heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const embed = new EmbedBuilder()
      .setTitle(client.user.username)
      .setColor(0x5865f2)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Uptime', value: formatDuration(client.uptime), inline: true },
        { name: 'Memory', value: `${heapMb} MB`, inline: true },
        {
          name: 'Features',
          value: ctx.registry.features.map(feature => feature.name).join(', ') || 'none',
          inline: true,
        },
        {
          name: 'Commands',
          value: `${ctx.registry.commands.size + ctx.registry.menus.length}`,
          inline: true,
        },
        {
          name: 'Runtime',
          value: `Node ${process.versions.node} · discord.js ${discordJsVersion}`,
          inline: true,
        },
      );
    await interaction.reply({ embeds: [embed] });
  },
});
