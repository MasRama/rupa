import { describe, expect, it } from 'vitest';
import { DailyChart, niceMax, TargetTable } from '../web/chart';
import { StatsSection, type StatsData } from '../web/stats';

describe('niceMax', () => {
  it('rounds the axis top up to a clean number', () => {
    expect(niceMax(0)).toBe(4);
    expect(niceMax(3)).toBe(4);
    expect(niceMax(7)).toBe(8);
    expect(niceMax(37)).toBe(40);
    expect(niceMax(1234)).toBe(1500);
  });
});

describe('DailyChart', () => {
  const days = [
    { day: '2026-10-23', uses: 4, errors: 1 },
    { day: '2026-10-24', uses: 0, errors: 0 },
    { day: '2026-10-25', uses: 8, errors: 0 },
  ];

  it('draws one column per day scaled to the axis, with a readable label', () => {
    const html = String(<DailyChart days={days} />);
    expect(html.match(/class="column"/g)).toHaveLength(3);
    expect(html).toContain('height:50%');
    expect(html).toContain('height:100%');
    expect(html).toContain('aria-label="Oct 23: 4 uses, 1 error"');
  });

  it('offers the same numbers as a table', () => {
    const html = String(<DailyChart days={days} />);
    expect(html).toContain('<td>Oct 25</td><td>8</td><td>0</td>');
  });
});

describe('blocked interactions', () => {
  const stats: StatsData = {
    days: 7,
    summary: { uses: 3, errors: 0, avgMs: 10, guilds: 1, users: null, blocked: 0 },
    daily: [{ day: '2026-10-25', uses: 3, errors: 0 }],
    targets: [
      {
        feature: 'general',
        kind: 'command',
        target: '/daily',
        uses: 3,
        errors: 0,
        blocked: 6,
        avgMs: 10,
      },
    ],
    features: [{ feature: 'general', uses: 3, errors: 0, blocked: 6 }],
  };

  it('shows a Blocked figure only when something was blocked', () => {
    expect(String(<StatsSection stats={stats} scope="server" />)).not.toContain('<dt>Blocked</dt>');
    const blocked = { ...stats, summary: { ...stats.summary, blocked: 6 } };
    expect(String(<StatsSection stats={blocked} scope="server" />)).toContain('<dt>Blocked</dt>');
  });

  it('gives each target a Blocked column', () => {
    const html = String(<TargetTable rows={stats.targets} />);
    expect(html).toContain('<th class="num">Blocked</th>');
    expect(html).toContain('<td class="num">6</td>');
  });
});
