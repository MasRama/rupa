import { button } from '@/core';
import { moderationBlocker } from '../hierarchy';
import { caseEmbed, notifyMember } from '../replies';
import { createCaseRepository } from '../repository';

const DAY_SECONDS = 24 * 60 * 60;

/**
 * "Ban" on the confirmation sent by /ban. The route carries the target and how
 * many days of messages to delete; the reason is read from the confirmation
 * embed so it does not count against the 100-character custom id limit.
 */
export const confirmBan = button('moderation:ban/:userId/:days', async (interaction, ctx) => {
  if (!interaction.inCachedGuild()) return;
  const { guild } = interaction;
  const { userId, days } = ctx.params;
  const reasonField = interaction.message.embeds[0]?.fields.find(field => field.name === 'Reason');
  const reason = reasonField && reasonField.value !== 'No reason given' ? reasonField.value : null;

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
  if (target) await notifyMember(user, guild.name, 'ban', reason);
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
  });
  ctx.logger.info({ guildId: guild.id, userId, caseId }, 'Member banned');

  await interaction.update({ content: `Done. Case #${caseId}.`, embeds: [], components: [] });
  await interaction.followUp({
    embeds: [
      caseEmbed({ action: 'ban', caseId, target: user, moderator: interaction.user, reason }),
    ],
  });
});

export const cancelBan = button('moderation:ban-cancel', async interaction => {
  await interaction.update({ content: 'Ban cancelled.', embeds: [], components: [] });
});
