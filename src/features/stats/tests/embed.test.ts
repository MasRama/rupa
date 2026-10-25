import { describe, expect, it } from 'vitest';
import { statsEmbed } from '../embed';

const summary = { uses: 3, errors: 1, avgMs: 120, guilds: 1, users: null, blocked: 0 };

describe('statsEmbed', () => {
  it('shows totals, a daily sparkline and the top targets', () => {
    const embed = statsEmbed({
      days: 7,
      summary,
      daily: [
        { day: '2026-10-24', uses: 1, errors: 0 },
        { day: '2026-10-25', uses: 2, errors: 1 },
      ],
      targets: [
        {
          feature: 'moderation',
          kind: 'command',
          target: '/ban',
          uses: 2,
          errors: 1,
          blocked: 0,
          avgMs: 150,
        },
        {
          feature: 'moderation',
          kind: 'button',
          target: 'moderation:ban/:userId/:days',
          uses: 1,
          errors: 0,
          blocked: 0,
          avgMs: 80,
        },
      ],
    }).toJSON();

    expect(embed.title).toBe('Usage in the last 7 days');
    expect(embed.description).toContain('▅█');
    expect(embed.fields).toEqual(
      expect.arrayContaining([
        { name: 'Uses', value: '3', inline: true },
        { name: 'Errors', value: '1 (33%)', inline: true },
        { name: 'Avg time', value: '120 ms', inline: true },
      ]),
    );
    const top = embed.fields?.find(field => field.name === 'Most used');
    expect(top?.value.split('\n')).toEqual([
      '`/ban` · 2 uses · 1 error',
      'button `moderation:ban/:userId/:days` · 1 use',
    ]);
  });

  it('says so when nothing was used', () => {
    const embed = statsEmbed({
      days: 30,
      summary: { ...summary, uses: 0, errors: 0, avgMs: 0, guilds: 0 },
      daily: [],
      targets: [],
    }).toJSON();
    expect(embed.description).toBe('Nothing has been used in this server in the last 30 days.');
    expect(embed.fields ?? []).toEqual([]);
  });

  it('shows blocked uses only when there were some', () => {
    const base = { days: 7, daily: [], targets: [] };
    const without = statsEmbed({ ...base, summary }).toJSON();
    expect(without.fields?.some(field => field.name === 'Blocked')).toBe(false);

    const withBlocked = statsEmbed({ ...base, summary: { ...summary, blocked: 5 } }).toJSON();
    expect(withBlocked.fields).toContainEqual({ name: 'Blocked', value: '5', inline: true });
  });

  it('mentions blocked uses of a target', () => {
    const embed = statsEmbed({
      days: 7,
      summary: { ...summary, blocked: 2 },
      daily: [],
      targets: [
        {
          feature: 'general',
          kind: 'command',
          target: '/daily',
          uses: 1,
          errors: 0,
          blocked: 2,
          avgMs: 5,
        },
      ],
    }).toJSON();
    const top = embed.fields?.find(field => field.name === 'Most used');
    expect(top?.value).toBe('`/daily` · 1 use · 2 blocked');
  });
});
