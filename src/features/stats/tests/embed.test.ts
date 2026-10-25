import { describe, expect, it } from 'vitest';
import { statsEmbed } from '../embed';

const summary = { uses: 3, errors: 1, avgMs: 120, guilds: 1, users: null };

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
        { feature: 'moderation', kind: 'command', target: '/ban', uses: 2, errors: 1, avgMs: 150 },
        {
          feature: 'moderation',
          kind: 'button',
          target: 'moderation:ban/:userId/:days',
          uses: 1,
          errors: 0,
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
});
