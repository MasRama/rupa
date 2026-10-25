import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { command } from '@/core';
import { ephemeral } from '../replies';

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

export const clearCommand = command({
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete recent messages in this channel')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many messages (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .addUserOption(option =>
      option.setName('user').setDescription('Only delete messages from this user'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const channel = interaction.channel;
    if (!channel || !('bulkDelete' in channel)) {
      await interaction.reply(ephemeral('Messages can only be cleared in text channels.'));
      return;
    }
    const me = await interaction.guild.members.fetchMe();
    if (!channel.permissionsFor(me).has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply(ephemeral('I need the Manage Messages permission in this channel.'));
      return;
    }

    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const fetched = await channel.messages.fetch({ limit: 100 });
    const cutoff = Date.now() - FOURTEEN_DAYS;
    const candidates = [...fetched.values()]
      .filter(message => !user || message.author.id === user.id)
      .slice(0, amount);
    const deletable = candidates.filter(message => message.createdTimestamp > cutoff);
    const tooOld = candidates.length - deletable.length;

    if (deletable.length === 0) {
      await interaction.editReply(
        candidates.length === 0
          ? 'No matching messages found.'
          : 'Those messages are older than 14 days, which Discord does not allow bots to bulk delete.',
      );
      return;
    }

    const deleted = await channel.bulkDelete(deletable, true);
    ctx.logger.info(
      { channelId: channel.id, deleted: deleted.size, userId: user?.id },
      'Messages cleared',
    );
    await interaction.editReply(
      `Deleted ${deleted.size} message(s)${user ? ` from ${user}` : ''}.` +
        (tooOld > 0 ? ` Skipped ${tooOld} older than 14 days.` : ''),
    );
  },
});
