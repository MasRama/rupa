import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputStyle,
  type ThreadChannel,
} from 'discord.js';
import { button, cooldown, modal, requireBotPermissions } from '@/core';
import { threadName } from '../logic';
import { createTicketRepository } from '../repository';
import { ticketSettings } from '../settings';
import { closeButton } from './close';

const SUBJECT_INPUT = 'subject';

const canMakeThreads = requireBotPermissions(
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.ManageThreads,
);

/** Submitted "What do you need help with?" form: makes the ticket thread. */
export const openForm = modal(
  'tickets:open-form',
  async (interaction, ctx) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const repo = createTicketRepository(ctx.db);
    const { user, guildId } = interaction;

    const existing = repo.findOpenByOpener(guildId, user.id);
    if (existing) {
      await interaction.editReply(`You already have an open ticket: <#${existing.threadId}>.`);
      return;
    }
    const channel = interaction.channel;
    if (channel?.type !== ChannelType.GuildText) {
      await interaction.editReply('Tickets can only be opened from a text channel.');
      return;
    }

    const subject = interaction.fields.getTextInputValue(SUBJECT_INPUT).trim();
    const id = repo.open({ guildId, channelId: channel.id, openerId: user.id, subject });
    const { staffRole } = ticketSettings.read(ctx, guildId);
    let thread: ThreadChannel | null = null;
    try {
      thread = await channel.threads.create({
        name: threadName(id),
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Ticket #${id} opened by ${user.username}`,
      });
      repo.setThread(id, thread.id);
      await thread.members.add(user.id);
      await thread.send({
        content: staffRole ? `<@${user.id}> <@&${staffRole}>` : `<@${user.id}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle(`Ticket #${id}`)
            .setDescription(subject)
            .setColor(0x5865f2)
            .setFooter({ text: 'Staff will answer here. Close the ticket when you are done.' }),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(closeButton.id({ ticketId: String(id) }))
              .setLabel('Close')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
        allowedMentions: { users: [user.id], roles: staffRole ? [staffRole] : [] },
      });
      ctx.logger.info({ guildId, ticketId: id, userId: user.id }, 'Ticket opened');
      await interaction.editReply(`Your ticket is open: <#${thread.id}>.`);
    } catch (error) {
      ctx.logger.warn({ err: error, guildId, ticketId: id }, 'Could not open a ticket thread');
      await thread?.delete().catch(() => undefined);
      repo.remove(id);
      await interaction.editReply(
        'I could not open a ticket here. Ask an admin to check my permissions.',
      );
    }
  },
  { guards: [canMakeThreads] },
);

/** "Open ticket" on the panel: asks what the user needs help with. */
export const openButton = button(
  'tickets:open',
  async (interaction, ctx) => {
    if (!interaction.inCachedGuild()) return;
    const existing = createTicketRepository(ctx.db).findOpenByOpener(
      interaction.guildId,
      interaction.user.id,
    );
    if (existing) {
      await interaction.reply({
        content: `You already have an open ticket: <#${existing.threadId}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(openForm.id())
        .setTitle('Open a ticket')
        .addLabelComponents(label =>
          label
            .setLabel('What do you need help with?')
            .setTextInputComponent(input =>
              input
                .setCustomId(SUBJECT_INPUT)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000),
            ),
        ),
    );
  },
  { guards: [canMakeThreads, cooldown('10s')] },
);
