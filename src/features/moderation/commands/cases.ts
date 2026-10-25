import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { command } from '@/core';
import { createCaseRepository } from '../repository';

const SHOWN = 10;

export const casesCommand = command({
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription("Show a member's moderation history")
    .addUserOption(option =>
      option.setName('user').setDescription('Whose history').setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const user = interaction.options.getUser('user', true);
    const cases = createCaseRepository(ctx.db);
    const recent = cases.listForMember(interaction.guildId, user.id, SHOWN);
    const total = cases.countForMember(interaction.guildId, user.id);

    const embed = new EmbedBuilder()
      .setTitle(`Cases for ${user.username}`)
      .setColor(0x5865f2)
      .setDescription(
        recent.length === 0
          ? 'No cases on record.'
          : recent
              .map(entry => {
                const when = `<t:${Math.floor(Date.parse(entry.createdAt) / 1000)}:R>`;
                return `**#${entry.id}** ${entry.action} · ${when} · by <@${entry.moderatorId}>\n${entry.reason ?? 'No reason given'}`;
              })
              .join('\n\n'),
      )
      .setFooter({ text: total > SHOWN ? `Showing ${SHOWN} of ${total}` : `${total} total` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});
