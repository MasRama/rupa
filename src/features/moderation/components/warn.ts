import { ModalBuilder, TextInputStyle } from 'discord.js';
import { modal } from '@/core';
import { caseEmbed, ephemeral, notifyMember } from '../replies';
import { createCaseRepository } from '../repository';

const REASON_INPUT = 'reason';

/** Submitted reason for /warn; the route carries who is being warned. */
export const warnReason = modal('moderation:warn/:userId', async (interaction, ctx) => {
  if (!interaction.inCachedGuild()) return;
  const { guild } = interaction;
  const { userId } = ctx.params;
  const reason = interaction.fields.getTextInputValue(REASON_INPUT).trim();
  if (!reason) {
    await interaction.reply(ephemeral('A warning needs a reason.'));
    return;
  }

  const cases = createCaseRepository(ctx.db);
  const caseId = cases.add({
    guildId: guild.id,
    userId,
    moderatorId: interaction.user.id,
    action: 'warn',
    reason,
  });
  const total = cases.countForMember(guild.id, userId);
  const user = await interaction.client.users.fetch(userId);
  const delivered = await notifyMember(user, guild.name, 'warn', reason);
  ctx.logger.info({ guildId: guild.id, userId, caseId }, 'Member warned');

  await interaction.reply({
    embeds: [
      caseEmbed({
        action: 'warn',
        caseId,
        target: user,
        moderator: interaction.user,
        reason,
      }).setFooter({
        text: `${total} case(s) on record${delivered ? '' : ' · could not DM the member'}`,
      }),
    ],
  });
});

export function warnModal(userId: string, username: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(warnReason.id({ userId }))
    .setTitle(`Warn ${username}`.slice(0, 45))
    .addLabelComponents(label =>
      label
        .setLabel('Reason')
        .setDescription('Sent to the member and kept in their case history')
        .setTextInputComponent(input =>
          input
            .setCustomId(REASON_INPUT)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500),
        ),
    );
}
