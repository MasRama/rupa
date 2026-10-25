import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { command, formatDuration, requireBotPermissions } from '@/core';
import { cancelBan, confirmBan } from '../components/ban';
import { parseBanDuration } from '../duration';
import { moderationBlocker } from '../hierarchy';
import { ephemeral } from '../replies';

export const banCommand = command({
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server (asks for confirmation)')
    .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Why they are banned').setMaxLength(500),
    )
    .addIntegerOption(option =>
      option
        .setName('delete_days')
        .setDescription('Days of their messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7),
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Lift the ban after this long, e.g. 1h, 7d or 30d (default: permanent)')
        .setMaxLength(20),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild),

  guards: [requireBotPermissions(PermissionFlagsBits.BanMembers)],

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const { guild } = interaction;
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason');
    const days = interaction.options.getInteger('delete_days') ?? 0;
    const duration = parseBanDuration(interaction.options.getString('duration'));
    if ('error' in duration) {
      await interaction.reply(ephemeral(duration.error));
      return;
    }

    const blocker = moderationBlocker({
      action: 'ban',
      actor: interaction.member,
      bot: await guild.members.fetchMe(),
      ownerId: guild.ownerId,
      targetId: user.id,
      target: interaction.options.getMember('user'),
    });
    if (blocker) {
      await interaction.reply(ephemeral(blocker));
      return;
    }

    const confirmation = new EmbedBuilder()
      .setTitle(`Ban ${user.username}?`)
      .setColor(0xed4245)
      .addFields(
        { name: 'User', value: `${user} (${user.id})` },
        { name: 'Reason', value: reason ?? 'No reason given' },
        { name: 'Delete messages', value: days === 0 ? 'None' : `Last ${days} day(s)` },
        {
          name: 'Duration',
          value: duration.seconds === 0 ? 'Permanent' : formatDuration(duration.seconds * 1000),
        },
      );
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          confirmBan.id({
            userId: user.id,
            days: String(days),
            seconds: String(duration.seconds),
          }),
        )
        .setLabel('Ban')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(cancelBan.id())
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      embeds: [confirmation],
      components: [buttons],
      flags: MessageFlags.Ephemeral,
    });
  },
});
