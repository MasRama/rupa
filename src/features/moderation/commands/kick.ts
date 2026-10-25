import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { command } from '@/core';
import { moderationBlocker } from '../hierarchy';
import { caseEmbed, ephemeral, notifyMember, postToLogChannel } from '../replies';
import { createCaseRepository } from '../repository';
import { moderationSettings } from '../settings';

export const kickCommand = command({
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Remove a member from the server')
    .addUserOption(option =>
      option.setName('member').setDescription('Member to kick').setRequired(true),
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Why they are kicked').setMaxLength(500),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const { guild } = interaction;
    const user = interaction.options.getUser('member', true);
    const target = interaction.options.getMember('member');
    const reason = interaction.options.getString('reason');

    if (!target) {
      await interaction.reply(ephemeral('That user is not a member of this server.'));
      return;
    }
    const blocker = moderationBlocker({
      action: 'kick',
      actor: interaction.member,
      bot: await guild.members.fetchMe(),
      ownerId: guild.ownerId,
      targetId: user.id,
      target,
    });
    if (blocker) {
      await interaction.reply(ephemeral(blocker));
      return;
    }

    const settings = moderationSettings.read(ctx, guild.id);
    if (settings.dmMembers) await notifyMember(user, guild.name, 'kick', reason);
    await target.kick(`${reason ?? 'No reason given'} (by ${interaction.user.username})`);
    const caseId = createCaseRepository(ctx.db).add({
      guildId: guild.id,
      userId: user.id,
      moderatorId: interaction.user.id,
      action: 'kick',
      reason,
    });
    ctx.logger.info({ guildId: guild.id, userId: user.id, caseId }, 'Member kicked');

    const embed = caseEmbed({
      action: 'kick',
      caseId,
      target: user,
      moderator: interaction.user,
      reason,
    });
    await interaction.reply({ embeds: [embed] });
    await postToLogChannel(guild, settings.logChannel, embed, ctx.logger);
  },
});
