import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import { ICommand } from '@/types/bot';

export const serverinfoCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display information about the current server'),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    
    // Get channel counts
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const threads = guild.channels.cache.filter(c => c.isThread()).size;

    // Get member counts
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(member => member.presence?.status !== 'offline').size;
    const bots = guild.members.cache.filter(member => member.user.bot).size;
    const humans = totalMembers - bots;

    // Get role count
    const roleCount = guild.roles.cache.size - 1; // Exclude @everyone role

    // Get boost information
    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount || 0;

    // Get verification level
    const verificationLevels = {
      0: 'None',
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Very High',
    };

    const embed = new EmbedBuilder()
      .setTitle(`🏠 ${guild.name}`)
      .setColor(0x5865F2)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        {
          name: '📊 General Information',
          value: [
            `**Owner:** <@${guild.ownerId}>`,
            `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
            `**ID:** ${guild.id}`,
            `**Verification Level:** ${verificationLevels[guild.verificationLevel as keyof typeof verificationLevels]}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '👥 Members',
          value: [
            `**Total:** ${totalMembers}`,
            `**Humans:** ${humans}`,
            `**Bots:** ${bots}`,
            `**Online:** ${onlineMembers}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '📺 Channels',
          value: [
            `**Text:** ${textChannels}`,
            `**Voice:** ${voiceChannels}`,
            `**Categories:** ${categories}`,
            `**Threads:** ${threads}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🎭 Other',
          value: [
            `**Roles:** ${roleCount}`,
            `**Emojis:** ${guild.emojis.cache.size}`,
            `**Stickers:** ${guild.stickers.cache.size}`,
          ].join('\n'),
          inline: true,
        }
      );

    // Add boost information if the server has boosts
    if (boostCount > 0) {
      embed.addFields({
        name: '💎 Server Boost',
        value: [
          `**Level:** ${boostLevel}`,
          `**Boosts:** ${boostCount}`,
        ].join('\n'),
        inline: true,
      });
    }

    // Add features if any
    if (guild.features.length > 0) {
      const features = guild.features
        .map(feature => feature.toLowerCase().replace(/_/g, ' '))
        .map(feature => feature.charAt(0).toUpperCase() + feature.slice(1))
        .join(', ');
      
      embed.addFields({
        name: '✨ Features',
        value: features,
      });
    }

    // Set banner if available
    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }));
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

    await interaction.reply({ embeds: [embed] });
  },
};