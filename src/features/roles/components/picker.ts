import {
  ActionRowBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { button, requireBotPermissions, select } from '@/core';
import { canGive, changeSummary, roleChanges } from '../logic';
import { createPanelRepository } from '../repository';

const canManageRoles = requireBotPermissions(PermissionFlagsBits.ManageRoles);
const GONE = 'This role panel no longer exists.';

/** The member's choice from the picker: gives and takes the panel's roles. */
export const pickRoles = select(
  'roles:pick/:panelId',
  async (interaction, ctx) => {
    if (!interaction.inCachedGuild()) return;
    const panel = createPanelRepository(ctx.db).get(Number(ctx.params.panelId));
    if (!panel) {
      await interaction.update({ content: GONE, components: [] });
      return;
    }
    const { guild, member } = interaction;
    const offered = panel.roleIds.filter(id => guild.roles.cache.has(id));
    const changes = roleChanges({
      offered,
      selected: interaction.values,
      current: [...member.roles.cache.keys()],
    });

    // Roles may have moved or become managed since the panel was made.
    const me = await guild.members.fetchMe();
    const limits = {
      everyoneId: guild.roles.everyone.id,
      botTopPosition: me.roles.highest.position,
    };
    const givable = (id: string) => canGive(guild.roles.cache.get(id)!, limits);
    const add = changes.add.filter(givable);
    const remove = changes.remove.filter(givable);
    const skipped = [...changes.add, ...changes.remove].filter(id => !givable(id));

    const reason = `Role panel #${panel.id}`;
    if (add.length > 0) await member.roles.add(add, reason);
    if (remove.length > 0) await member.roles.remove(remove, reason);
    await interaction.update({
      content: changeSummary({ added: add, removed: remove, skipped }),
      components: [],
    });
  },
  { guards: [canManageRoles] },
);

/** "Choose roles" on the panel: a private picker with the member's roles ticked. */
export const openPicker = button(
  'roles:open/:panelId',
  async (interaction, ctx) => {
    if (!interaction.inCachedGuild()) return;
    const panel = createPanelRepository(ctx.db).get(Number(ctx.params.panelId));
    if (!panel) {
      await interaction.reply({ content: GONE, flags: MessageFlags.Ephemeral });
      return;
    }
    const roles = panel.roleIds
      .map(id => interaction.guild.roles.cache.get(id))
      .filter(role => role !== undefined);
    if (roles.length === 0) {
      await interaction.reply({
        content: 'This panel has no roles left.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(pickRoles.id({ panelId: String(panel.id) }))
      .setPlaceholder(panel.single ? 'Pick a role' : 'Pick your roles')
      .setMinValues(0)
      .setMaxValues(panel.single ? 1 : roles.length)
      .addOptions(
        roles.map(role =>
          new StringSelectMenuOptionBuilder()
            .setLabel(role.name.slice(0, 100))
            .setValue(role.id)
            .setDefault(interaction.member.roles.cache.has(role.id)),
        ),
      );
    await interaction.reply({
      content: panel.title,
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
  { guards: [canManageRoles] },
);
