import { RESTJSONErrorCodes } from 'discord.js';
import { job, type JobScheduler } from '@/core';
import { caseEmbed, postToLogChannel } from './replies';
import { createCaseRepository } from './repository';
import { moderationSettings } from './settings';

export const banKey = (guildId: string, userId: string) => `${guildId}:${userId}`;

/** Lifts a temporary ban and records it as a case by the bot. */
export const unban = job<{ guildId: string; userId: string; caseId: number }>(
  'unban',
  async ({ guildId, userId, caseId }, ctx) => {
    const guild = ctx.client.guilds.cache.get(guildId);
    if (!guild) return; // The bot left the server.

    const reason = `Temporary ban from case #${caseId} ended`;
    try {
      await guild.bans.remove(userId, reason);
    } catch (error) {
      // Someone lifted it by hand already.
      if ((error as { code?: unknown }).code === RESTJSONErrorCodes.UnknownBan) return;
      throw error;
    }

    const botUser = ctx.client.user!;
    const newCase = createCaseRepository(ctx.db).add({
      guildId,
      userId,
      moderatorId: botUser.id,
      action: 'unban',
      reason,
    });
    ctx.logger.info({ guildId, userId, caseId: newCase }, 'Temporary ban ended');

    const settings = moderationSettings.read(ctx, guildId);
    const embed = caseEmbed({
      action: 'unban',
      caseId: newCase,
      target: await ctx.client.users.fetch(userId),
      moderator: botUser,
      reason,
    });
    await postToLogChannel(guild, settings.logChannel, embed, ctx.logger);
  },
);

/** After a ban: schedule its end, or drop a pending one when the new ban is permanent. */
export function scheduleUnban(
  jobs: JobScheduler,
  ban: { guildId: string; userId: string; caseId: number; seconds: number },
): void {
  const key = banKey(ban.guildId, ban.userId);
  if (ban.seconds > 0) {
    jobs.schedule(
      unban,
      { guildId: ban.guildId, userId: ban.userId, caseId: ban.caseId },
      { in: ban.seconds * 1000, key },
    );
  } else {
    jobs.cancel(unban, key);
  }
}
