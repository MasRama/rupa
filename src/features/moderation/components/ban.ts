import { PermissionFlagsBits } from 'discord.js';
import { confirm, requireBotPermissions } from '@/core';
import { moderationBlocker } from '../hierarchy';
import { scheduleUnban } from '../jobs';
import { caseEmbed, notifyMember, postToLogChannel } from '../replies';
import { createCaseRepository } from '../repository';
import { moderationSettings } from '../settings';

const DAY_SECONDS = 24 * 60 * 60;

/**
 * The Ban / Cancel question sent by /ban. The route carries the target, how
 * many days of messages to delete and how long the ban lasts in seconds (0 for
 * permanent); the reason is read from the confirmation embed so it does not
 * count against the 100-character custom id limit.
 */
export const banConfirm = confirm('moderation:ban/:userId/:days/:seconds', {
  confirmLabel: 'Ban',
  cancelled: 'Ban cancelled.',
  guards: [requireBotPermissions(PermissionFlagsBits.BanMembers)],

  async onConfirm(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const { guild } = interaction;
    const { userId, days } = ctx.params;
    const seconds = Number(ctx.params.seconds);
    const expiresAt = seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null;
    const reasonField = interaction.message.embeds[0]?.fields.find(
      field => field.name === 'Reason',
    );
    const reason =
      reasonField && reasonField.value !== 'No reason given' ? reasonField.value : null;

    // Roles may have changed since /ban was run, so check again.
    const target = await guild.members.fetch(userId).catch(() => null);
    const blocker = moderationBlocker({
      action: 'ban',
      actor: interaction.member,
      bot: await guild.members.fetchMe(),
      ownerId: guild.ownerId,
      targetId: userId,
      target,
    });
    if (blocker) {
      await interaction.update({ content: blocker, embeds: [], components: [] });
      return;
    }

    const user = await interaction.client.users.fetch(userId);
    const settings = moderationSettings.read(ctx, guild.id);
    if (target && settings.dmMembers) await notifyMember(user, guild.name, 'ban', reason);
    await guild.bans.create(userId, {
      reason: `${reason ?? 'No reason given'} (by ${interaction.user.username})`,
      deleteMessageSeconds: Number(days) * DAY_SECONDS,
    });
    const caseId = createCaseRepository(ctx.db).add({
      guildId: guild.id,
      userId,
      moderatorId: interaction.user.id,
      action: 'ban',
      reason,
      expiresAt,
    });
    scheduleUnban(ctx.jobs, { guildId: guild.id, userId, caseId, seconds });
    ctx.logger.info({ guildId: guild.id, userId, caseId }, 'Member banned');

    await interaction.update({ content: `Done. Case #${caseId}.`, embeds: [], components: [] });
    const embed = caseEmbed({
      action: 'ban',
      caseId,
      target: user,
      moderator: interaction.user,
      reason,
      expiresAt,
    });
    await interaction.followUp({ embeds: [embed] });
    await postToLogChannel(guild, settings.logChannel, embed, ctx.logger);
  },
});
