import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { command, type Guard, requireBotPermissions, requirePermissions } from '@/core';
import { closeConfirm, ticketManager } from '../components/close';
import { openButton } from '../components/open';
import { createTicketRepository } from '../repository';

const ephemeral = (content: string) => ({ content, flags: MessageFlags.Ephemeral }) as const;

// Each subcommand has its own checks, so the guards pick by subcommand.
const forSubcommand =
  (name: string, guard: Guard): Guard =>
  (interaction, ctx) =>
    (interaction as ChatInputCommandInteraction).options.getSubcommand() === name
      ? guard(interaction, ctx)
      : null;

export const ticketCommand = command({
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Support tickets')
    .addSubcommand(sub =>
      sub.setName('panel').setDescription('Post an "Open ticket" button in this channel'),
    )
    .addSubcommand(sub => sub.setName('close').setDescription('Close the ticket you are in'))
    // Not limited by default: openers close their own tickets. The panel needs Manage Server.
    .setContexts(InteractionContextType.Guild),

  guards: [
    forSubcommand('panel', requirePermissions(PermissionFlagsBits.ManageGuild)),
    forSubcommand(
      'panel',
      requireBotPermissions(
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ),
    ),
    forSubcommand('close', ticketManager),
  ],

  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    if (interaction.options.getSubcommand() === 'close') {
      // The guard made sure this channel is an open ticket.
      const ticket = createTicketRepository(ctx.db).findByThread(interaction.channelId)!;
      await interaction.reply({
        content: 'Close this ticket?',
        components: [closeConfirm.buttons({ ticketId: String(ticket.id) })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.channel;
    if (channel?.type !== ChannelType.GuildText) {
      await interaction.reply(ephemeral('Post the panel in a text channel.'));
      return;
    }
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('Need help?')
          .setDescription('Open a ticket and talk to the staff in a private thread.')
          .setColor(0x5865f2),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(openButton.id())
            .setLabel('Open ticket')
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    });
    await interaction.reply(ephemeral('Ticket panel posted.'));
  },
});
