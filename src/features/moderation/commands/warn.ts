import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { command } from '@/core';
import { warnModal } from '../components/warn';
import { moderationBlocker } from '../hierarchy';
import { ephemeral } from '../replies';

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
    const { guild } = interaction;
    const user = interaction.options.getUser('member', true);
    const target = interaction.options.getMember('member');
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
  },
});
