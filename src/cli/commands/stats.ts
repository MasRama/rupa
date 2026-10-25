import type { AppConfig } from '@/core/config';
import { openDatabase } from '@/core/database';
import {
  createUsageQueries,
  sparkline,
  usageWindow,
  type DailyUsage,
  type FeatureUsage,
  type TargetUsage,
  type UsageSummary,
} from '@/core/usage';

const TOP_TARGETS = 15;

export interface StatsOptions {
  days: number;
  guildId?: string;
}

export interface StatsReportData {
  days: number;
  guildId: string | null;
  summary: UsageSummary;
  daily: DailyUsage[];
  targets: TargetUsage[];
  features: FeatureUsage[];
}

/** `--days 30` / `--days=30` and `--guild <id>`; defaults to 7 days across all servers. */
export function parseStatsArgs(argv: readonly string[]): StatsOptions {
  const value = (name: string): string | undefined => {
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i]!;
      if (arg === name) return argv[i + 1];
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
    }
    return undefined;
  };

  const options: StatsOptions = { days: 7 };
  const days = value('--days');
  if (days !== undefined) {
    if (!/^\d+$/.test(days) || Number(days) < 1)
      throw new Error('--days must be a whole number above 0');
    options.days = Number(days);
  }
  const guildId = value('--guild');
  if (guildId !== undefined) {
    if (!/^\d+$/.test(guildId)) throw new Error('--guild must be a numeric Discord server id');
    options.guildId = guildId;
  }
  return options;
}

const percent = (part: number, whole: number) =>
  whole === 0 ? '0%' : `${((part / whole) * 100).toFixed(1)}%`;

export function formatStatsReport(data: StatsReportData): string {
  const scope = data.guildId ? `server ${data.guildId}` : 'all servers';
  const lines = [`Usage in the last ${data.days} days, ${scope}`, ''];
  const { summary } = data;

  if (summary.uses === 0 && summary.blocked === 0) {
    lines.push('No usage recorded in this period.');
    return lines.join('\n');
  }

  lines.push(
    `  Uses      ${summary.uses}`,
    `  Errors    ${summary.errors} (${percent(summary.errors, summary.uses)})`,
    `  Avg time  ${summary.avgMs} ms`,
    `  Servers   ${summary.guilds}`,
    `  Users     ${summary.users ?? 'not tracked'}`,
    `  Blocked   ${summary.blocked}`,
    '',
    `  Daily     ${sparkline(data.daily.map(day => day.uses))}  ` +
      `(${data.daily[0]?.day} → ${data.daily.at(-1)?.day})`,
    '',
    'Top targets',
  );

  const width = Math.max(...data.targets.map(row => row.target.length));
  const counts = (...values: (number | string)[]) =>
    values.map(value => String(value).padStart(7)).join(' ');
  lines.push(`  ${counts('uses', 'errors', 'blocked')}  ${'avg'.padStart(8)}  target`);
  for (const row of data.targets) {
    lines.push(
      `  ${counts(row.uses, row.errors, row.blocked)}  ` +
        `${`${row.avgMs} ms`.padStart(8)}  ${row.target.padEnd(width)}  ${row.feature}`,
    );
  }

  lines.push('', 'By feature');
  const featureWidth = Math.max(...data.features.map(row => row.feature.length));
  lines.push(`  ${''.padEnd(featureWidth)} ${counts('uses', 'errors', 'blocked')}`);
  for (const row of data.features) {
    lines.push(
      `  ${row.feature.padEnd(featureWidth)} ${counts(row.uses, row.errors, row.blocked)}`,
    );
  }
  return lines.join('\n');
}

export function statsCommand(config: AppConfig, argv: readonly string[]): void {
  const options = parseStatsArgs(argv);
  const db = openDatabase(config.databasePath);
  try {
    const range = {
      ...usageWindow(options.days),
      ...(options.guildId && { guildId: options.guildId }),
    };
    const queries = createUsageQueries(db);
    console.log(
      formatStatsReport({
        days: options.days,
        guildId: options.guildId ?? null,
        summary: queries.summary(range),
        daily: queries.daily(range),
        targets: queries.byTarget(range, TOP_TARGETS),
        features: queries.byFeature(range),
      }),
    );
  } finally {
    db.close();
  }
}
