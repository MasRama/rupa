import { describe, expect, it } from 'vitest';
import { formatStatsReport, parseStatsArgs, type StatsReportData } from '../commands/stats';

const data: StatsReportData = {
  days: 7,
  guildId: null,
  summary: { uses: 3, errors: 1, avgMs: 120, guilds: 2, users: null },
  daily: [
    { day: '2026-10-24', uses: 1, errors: 0 },
    { day: '2026-10-25', uses: 2, errors: 1 },
  ],
  targets: [
    { feature: 'moderation', kind: 'command', target: '/ban', uses: 2, errors: 1, avgMs: 150 },
    { feature: 'general', kind: 'command', target: '/ping', uses: 1, errors: 0, avgMs: 60 },
  ],
  features: [
    { feature: 'moderation', uses: 2, errors: 1 },
    { feature: 'general', uses: 1, errors: 0 },
  ],
};

describe('formatStatsReport', () => {
  it('summarises the period across all servers', () => {
    const report = formatStatsReport(data);
    expect(report).toContain('Usage in the last 7 days, all servers');
    expect(report).toMatch(/Uses\s+3/);
    expect(report).toMatch(/Errors\s+1 \(33\.3%\)/);
    expect(report).toMatch(/Avg time\s+120 ms/);
    expect(report).toMatch(/Users\s+not tracked/);
    expect(report).toContain('▅█');
  });

  it('lists top targets and features with their counts', () => {
    const lines = formatStatsReport(data).split('\n');
    expect(lines.find(line => line.includes('/ban'))).toMatch(
      /2\s+1\s+150 ms\s+\/ban\s+moderation/,
    );
    expect(lines.find(line => line.includes('/ping'))).toMatch(/1\s+0\s+60 ms\s+\/ping\s+general/);
    expect(lines.some(line => /^\s+moderation\s+2\s+1$/.test(line))).toBe(true);
  });

  it('names the server when scoped', () => {
    expect(formatStatsReport({ ...data, guildId: '123' })).toContain(
      'Usage in the last 7 days, server 123',
    );
  });

  it('says so when nothing was recorded', () => {
    const empty = formatStatsReport({
      ...data,
      summary: { uses: 0, errors: 0, avgMs: 0, guilds: 0, users: null },
      targets: [],
      features: [],
    });
    expect(empty).toContain('No usage recorded');
  });
});

describe('parseStatsArgs', () => {
  it('defaults to 7 days across all servers', () => {
    expect(parseStatsArgs([])).toEqual({ days: 7 });
  });

  it('reads --days and --guild in both spellings', () => {
    expect(parseStatsArgs(['--days', '30', '--guild=123'])).toEqual({ days: 30, guildId: '123' });
  });

  it('rejects a bad day count or server id', () => {
    expect(() => parseStatsArgs(['--days', '0'])).toThrow(/--days/);
    expect(() => parseStatsArgs(['--guild', 'abc'])).toThrow(/--guild/);
  });
});
