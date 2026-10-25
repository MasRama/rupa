import {
  createUsageQueries,
  usageWindow,
  type Database,
  type DailyUsage,
  type FeatureUsage,
  type TargetUsage,
  type UsageSummary,
} from '@/core';
import { DailyChart, FeatureTable, TargetTable } from './chart';
import { formatNumber } from './format';

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export const parsePeriod = (value: string | undefined): Period =>
  PERIODS.find(days => String(days) === value) ?? 30;

export interface StatsData {
  days: Period;
  summary: UsageSummary;
  daily: DailyUsage[];
  targets: TargetUsage[];
  features: FeatureUsage[];
}

export function loadStats(db: Database, days: Period, guildId?: string): StatsData {
  const range = { ...usageWindow(days), ...(guildId && { guildId }) };
  const queries = createUsageQueries(db);
  return {
    days,
    summary: queries.summary(range),
    daily: queries.daily(range),
    targets: queries.byTarget(range, 10),
    features: queries.byFeature(range),
  };
}

export function PeriodPicker({ base, days }: { base: string; days: Period }) {
  return (
    <nav class="periods" aria-label="Period">
      {PERIODS.map(option => (
        <a href={`${base}?days=${option}`} aria-current={option === days ? 'true' : undefined}>
          Last {option} days
        </a>
      ))}
    </nav>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div class="figure">
      <dt>{label}</dt>
      <dd>
        {value}
        {note && <span class="note">{note}</span>}
      </dd>
    </div>
  );
}

export function StatsSection({ stats, scope }: { stats: StatsData; scope: 'server' | 'all' }) {
  const { summary } = stats;
  if (summary.uses === 0 && summary.blocked === 0) {
    return (
      <section class="stats empty">
        <p>
          Nothing was used in the last {stats.days} days. Usage shows up here as soon as someone
          runs a command or clicks a button.
        </p>
      </section>
    );
  }

  const errorRate =
    summary.uses === 0 ? 0 : Math.round((summary.errors / summary.uses) * 1000) / 10;
  return (
    <section class="stats" aria-label="Usage">
      <dl class="figures">
        <Figure label="Uses" value={formatNumber(summary.uses)} />
        <Figure label="Errors" value={formatNumber(summary.errors)} note={`${errorRate}%`} />
        <Figure label="Average time" value={`${formatNumber(summary.avgMs)} ms`} />
        {summary.blocked > 0 && (
          <Figure label="Blocked" value={formatNumber(summary.blocked)} note="by a guard" />
        )}
        {scope === 'all' && <Figure label="Servers" value={formatNumber(summary.guilds)} />}
        {summary.users !== null && <Figure label="People" value={formatNumber(summary.users)} />}
      </dl>
      <h2 class="chart-title">Uses per day</h2>
      <DailyChart days={stats.daily} />
      <div class="split">
        <div>
          <h2>Most used</h2>
          <TargetTable rows={stats.targets} />
        </div>
        <div>
          <h2>By feature</h2>
          <FeatureTable rows={stats.features} />
        </div>
      </div>
    </section>
  );
}
