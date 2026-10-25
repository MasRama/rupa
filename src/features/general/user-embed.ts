import { EmbedBuilder, type GuildMember, type User } from 'discord.js';
import { relativeTime } from './format';

const SHOWN_ROLES = 10;

/**
 * A user's profile card. Pass the member when the bot can see the server
 * (it cannot when the command comes from a user install), to add server details.
 */
export function userEmbed(user: User, member: GuildMember | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(user.displayName)
    .setColor(member?.displayColor || 0x5865f2)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Username', value: user.username, inline: true },
      { name: 'ID', value: user.id, inline: true },
      { name: 'Account created', value: relativeTime(user.createdTimestamp), inline: true },
    );
  if (!member) return embed;

  const roles = member.roles.cache
    .filter(role => role.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .map(role => `${role}`);
  embed.addFields(
    {
      name: 'Joined server',
      value: member.joinedTimestamp ? relativeTime(member.joinedTimestamp) : 'Unknown',
      inline: true,
    },
    {
      name: `Roles (${roles.length})`,
      value:
        roles.length === 0
          ? 'None'
          : roles.slice(0, SHOWN_ROLES).join(' ') + (roles.length > SHOWN_ROLES ? ' …' : ''),
    },
  );
  if (member.premiumSinceTimestamp) {
    embed.addFields({
      name: 'Boosting since',
      value: relativeTime(member.premiumSinceTimestamp),
      inline: true,
    });
  }
  return embed;
}
