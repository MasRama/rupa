import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
  type UserContextMenuCommandInteraction,
} from 'discord.js';
import { command, userCommand } from '@/core';
import { warnModal } from '../components/warn';
import { moderationBlocker } from '../hierarchy';
import { ephemeral } from '../replies';

/** Checks that `user` can be warned, then asks for the reason. Shared by /warn and the menu. */
async function startWarning(
  interaction: ChatInputCommandInteraction<'cached'> | UserContextMenuCommandInteraction<'cached'>,
  user: User,
  target: GuildMember | null,
): Promise<void> {
  const { guild } = interaction;
  if (!target) {
    await interaction.reply(ephemeral('That user is not a member of this server.'));
    return;
  }
  const blocker = moderationBlocker({
    action: 'warn',
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

  await interaction.showModal(warnModal(user.id, user.username));
}

export const warnCommand = command({
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member; you will be asked for the reason')
    .addUserOption(option =>
      option.setName('member').setDescription('Member to warn').setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    await startWarning(
      interaction,
      interaction.options.getUser('member', true),
      interaction.options.getMember('member'),
    );
  },
});

/** Right-click a member → Apps → Warn: the same checks and reason form as /warn. */
export const warnMenu = userCommand({
  data: new ContextMenuCommandBuilder()
    .setName('Warn')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    await startWarning(interaction, interaction.targetUser, interaction.targetMember);
  },
});
