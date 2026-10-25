import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration } from '../duration';

describe('parseDuration', () => {
  it.each([
    ['30s', 30_000],
    ['10m', 600_000],
    ['2h', 7_200_000],
    ['7d', 604_800_000],
    ['1w', 604_800_000],
    ['1h30m', 5_400_000],
    [' 2H ', 7_200_000],
  ])('reads %j', (input, ms) => {
    expect(parseDuration(input)).toBe(ms);
  });

  it.each(['', '0s', '10', 'abc', '5y', '-1h', '1h 30m'])('rejects %j', input => {
    expect(() => parseDuration(input)).toThrow('Use a duration like 30s, 10m, 2h, 7d or 1h30m');
  });
});

describe('formatDuration', () => {
  it.each([
    [5_400_000, '1h 30m'],
    [604_800_000, '7d'],
    [90_061_000, '1d 1h'],
    [45_000, '45s'],
    [500, '0s'],
  ])('formats %d ms as %j', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
