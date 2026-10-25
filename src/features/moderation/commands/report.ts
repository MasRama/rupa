import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  type Message,
  type User,
} from 'discord.js';
import { cooldown, messageCommand } from '@/core';
import { ephemeral, postToLogChannel } from '../replies';
import { moderationSettings } from '../settings';

const FIELD_LIMIT = 1024;

/** The reported message's text for an embed field, shortened to fit. */
function messageText(message: Message): string {
  const attachments = message.attachments.size;
  const note = attachments > 0 ? `*${attachments} attachment(s)*` : '';
  if (!message.content) return note || '*No text*';
  const suffix = note ? `\n${note}` : '';
  const room = FIELD_LIMIT - suffix.length;
  const text =
    message.content.length > room ? `${message.content.slice(0, room - 1)}…` : message.content;
  return text + suffix;
}

/** What moderators see in the log channel. */
export function reportEmbed(message: Message, reporter: User): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Message reported')
    .setURL(message.url)
    .setColor(0xed4245)
    .addFields(
      { name: 'Author', value: `${message.author} (${message.author.username})`, inline: true },
      { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
      { name: 'Reported by', value: `${reporter}`, inline: true },
      { name: 'Message', value: messageText(message) },
    )
    .setTimestamp(message.createdTimestamp);
}

/** Right-click a message → Apps → Report message: sends it to the moderators' log channel. */
export const reportMenu = messageCommand({
  data: new ContextMenuCommandBuilder()
    .setName('Report message')
    .setType(ApplicationCommandType.Message)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  guards: [cooldown('30s')],

  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const { logChannel } = moderationSettings.read(ctx, interaction.guildId);
    if (!logChannel) {
      await interaction.reply(
        ephemeral('This server has no moderation log channel yet. Ask an admin to set one.'),
      );
      return;
    }

    const embed = reportEmbed(interaction.targetMessage, interaction.user);
    const posted = await postToLogChannel(interaction.guild, logChannel, embed, ctx.logger);
    await interaction.reply(
      ephemeral(
        posted
          ? 'Thanks, the moderators have been told.'
          : 'The report could not be posted to the log channel. Please tell a moderator.',
      ),
    );
  },
});
