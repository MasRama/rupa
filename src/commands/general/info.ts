import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, version as djsVersion } from 'discord.js';
import { ICommand } from '@/types/bot';
import { logger } from '@/services/logger';
import { config } from '@/services/config';

export const infoCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Display bot information and statistics'),

  async execute(interaction: CommandInteraction): Promise<void> {
    try {
      const client = interaction.client;
      const uptime = client.uptime ? Math.floor(client.uptime / 1000) : 0;
      
      // Calculate uptime
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = uptime % 60;
      
      const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      // Get system information
      const memoryUsage = process.memoryUsage();
      const memoryUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const memoryTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Information')
        .setColor(0x5865F2)
        .setThumbnail(client.user?.displayAvatarURL() || null)
        .addFields(
          {
            name: '📊 Statistics',
            value: [
              `**Guilds:** ${client.guilds.cache.size}`,
              `**Users:** ${client.users.cache.size}`,
              `**Channels:** ${client.channels.cache.size}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '⚡ Performance',
            value: [
              `**Uptime:** ${uptimeString}`,
              `**Memory:** ${memoryUsed}MB / ${memoryTotal}MB`,
              `**Ping:** ${Math.round(client.ws.ping)}ms`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🔧 Technical',
            value: [
              `**Node.js:** ${process.version}`,
              `**Discord.js:** v${djsVersion}`,
              `**Environment:** ${config.nodeEnv}`,
            ].join('\n'),
            inline: true,
          }
        )
        .setFooter({
          text: `Bot ID: ${client.user?.id}`,
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info('Info command executed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    } catch (error) {
      logger.error('Error executing info command', error);
      throw error;
    }
  },
};