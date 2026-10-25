import { ChannelType, EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { command } from '@/core';
import { relativeTime } from '../format';

export const serverinfoCommand = command({
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show information about this server')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const { guild } = interaction;
    const channels = guild.channels.cache;
    const text = channels.filter(channel => channel.type === ChannelType.GuildText).size;
    const voice = channels.filter(channel => channel.type === ChannelType.GuildVoice).size;

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setColor(0x5865f2)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Members', value: `${guild.memberCount}`, inline: true },
        { name: 'Created', value: relativeTime(guild.createdTimestamp), inline: true },
        { name: 'Channels', value: `${text} text · ${voice} voice`, inline: true },
        { name: 'Roles', value: `${guild.roles.cache.size - 1}`, inline: true },
        {
          name: 'Boosts',
          value: `Level ${guild.premiumTier} · ${guild.premiumSubscriptionCount ?? 0} boosts`,
          inline: true,
        },
      )
      .setFooter({ text: `ID ${guild.id}` });

    await interaction.reply({ embeds: [embed] });
  },
});
