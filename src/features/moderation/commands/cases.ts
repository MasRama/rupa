import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { command, pages, type PageInfo } from '@/core';
import { createCaseRepository, type ModerationCase } from '../repository';

/** One page of a member's history, newest first. */
export function casesEmbed(input: {
  username: string;
  page: PageInfo;
  cases: ModerationCase[];
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Cases for ${input.username}`)
    .setColor(0x5865f2)
    .setDescription(
      input.cases.length === 0
        ? 'No cases on record.'
        : input.cases
            .map(entry => {
              const when = `<t:${Math.floor(Date.parse(entry.createdAt) / 1000)}:R>`;
              const until = entry.expiresAt
                ? ` until <t:${Math.floor(Date.parse(entry.expiresAt) / 1000)}:R>`
                : '';
              return `**#${entry.id}** ${entry.action}${until} · ${when} · by <@${entry.moderatorId}>\n${entry.reason ?? 'No reason given'}`;
            })
            .join('\n\n'),
    )
    .setFooter({ text: `${input.page.total} total` });
}

/** A member's case history, five cases a page. */
export const casePages = pages('moderation:cases/:userId', {
  pageSize: 5,
  count: (ctx, interaction) =>
    createCaseRepository(ctx.db).countForMember(interaction.guildId!, ctx.params.userId),
  async render(page, ctx, interaction) {
    const { userId } = ctx.params;
    const cases = createCaseRepository(ctx.db).listForMember(
      interaction.guildId!,
      userId,
      page.limit,
      page.offset,
    );
    const user = await interaction.client.users.fetch(userId);
    return { embeds: [casesEmbed({ username: user.username, page, cases })] };
  },
});

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
    const first = await casePages.first(interaction, ctx, { userId: user.id });
    await interaction.reply({ ...first, flags: MessageFlags.Ephemeral });
  },
});
