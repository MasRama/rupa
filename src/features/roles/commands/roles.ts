import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Role,
} from 'discord.js';
import { command, requireBotPermissions } from '@/core';
import { openPicker } from '../components/picker';
import { panelProblem } from '../logic';
import { createPanelRepository } from '../repository';

const MAX_ROLES = 10;
const ephemeral = (content: string) => ({ content, flags: MessageFlags.Ephemeral }) as const;

const data = new SlashCommandBuilder()
  .setName('roles')
  .setDescription('Self-assignable roles')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(sub => {
    sub
      .setName('panel')
      .setDescription('Post a panel where members choose their own roles')
      .addStringOption(option =>
        option.setName('title').setDescription('Panel title').setMaxLength(100).setRequired(true),
      );
    for (let n = 1; n <= MAX_ROLES; n++) {
      sub.addRoleOption(option =>
        option
          .setName(`role${n}`)
          .setDescription(n === 1 ? 'A role members can choose' : 'Another role')
          .setRequired(n === 1),
      );
    }
    return sub
      .addStringOption(option =>
        option.setName('description').setDescription('Text under the title').setMaxLength(500),
      )
      .addBooleanOption(option =>
        option.setName('single').setDescription('Members may hold only one of these roles'),
      );
  });

export const rolesCommand = command({
  data,
  guards: [
    requireBotPermissions(
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ),
  ],

  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const { guild, channel } = interaction;
    if (!channel?.isSendable()) {
      await interaction.reply(ephemeral('I cannot post in this channel.'));
      return;
    }

    const picked = new Map<string, Role>();
    for (let n = 1; n <= MAX_ROLES; n++) {
      const role = interaction.options.getRole(`role${n}`);
      if (role) picked.set(role.id, role);
    }
    const roles = [...picked.values()];
    const me = await guild.members.fetchMe();
    const problem = panelProblem(roles, {
      everyoneId: guild.roles.everyone.id,
      botTopPosition: me.roles.highest.position,
    });
    if (problem) {
      await interaction.reply(ephemeral(problem));
      return;
    }

    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description');
    const single = interaction.options.getBoolean('single') ?? false;
    const panels = createPanelRepository(ctx.db);
    const id = panels.create({
      guildId: guild.id,
      channelId: channel.id,
      title,
      description,
      single,
      createdBy: interaction.user.id,
      roleIds: roles.map(role => role.id),
    });

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x5865f2)
      .addFields({ name: single ? 'Pick one' : 'Roles', value: roles.join('\n') });
    if (description) embed.setDescription(description);
    const message = await channel.send({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(openPicker.id({ panelId: String(id) }))
            .setLabel('Choose roles')
            .setStyle(ButtonStyle.Primary),
        ),
      ],
      allowedMentions: { parse: [] },
    });
    panels.setMessage(id, message.id);
    ctx.logger.info({ guildId: guild.id, panelId: id }, 'Role panel posted');
    await interaction.reply(ephemeral('Role panel posted.'));
  },
});
