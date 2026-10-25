import { EmbedBuilder } from 'discord.js';
import { sparkline, type DailyUsage, type TargetUsage, type UsageSummary } from '@/core';

export interface StatsEmbedData {
  days: number;
  summary: UsageSummary;
  daily: DailyUsage[];
  targets: TargetUsage[];
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function targetLine(row: TargetUsage): string {
  const name = row.kind === 'command' ? `\`${row.target}\`` : `${row.kind} \`${row.target}\``;
  const errors = row.errors > 0 ? ` · ${plural(row.errors, 'error')}` : '';
  const blocked = row.blocked > 0 ? ` · ${row.blocked} blocked` : '';
  return `${name} · ${plural(row.uses, 'use')}${errors}${blocked}`;
}

export function statsEmbed({ days, summary, daily, targets }: StatsEmbedData): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(`Usage in the last ${days} days`).setColor(0x5865f2);
  if (summary.uses === 0 && summary.blocked === 0) {
    return embed.setDescription(`Nothing has been used in this server in the last ${days} days.`);
  }

  const errorRate = summary.uses === 0 ? 0 : Math.round((summary.errors / summary.uses) * 100);
  embed
    .setDescription(
      `\`${sparkline(daily.map(day => day.uses))}\`  ${daily[0]?.day} → ${daily.at(-1)?.day}`,
    )
    .addFields(
      { name: 'Uses', value: `${summary.uses}`, inline: true },
      { name: 'Errors', value: `${summary.errors} (${errorRate}%)`, inline: true },
      { name: 'Avg time', value: `${summary.avgMs} ms`, inline: true },
    );
  if (summary.blocked > 0) {
    embed.addFields({ name: 'Blocked', value: `${summary.blocked}`, inline: true });
  }
  if (summary.users !== null) {
    embed.addFields({ name: 'Members', value: `${summary.users}`, inline: true });
  }
  return embed.addFields({
    name: 'Most used',
    value: targets.map(targetLine).join('\n').slice(0, 1024),
  });
}
