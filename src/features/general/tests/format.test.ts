import { describe, expect, it } from 'vitest';
import { formatDuration } from '../format';

describe('formatDuration', () => {
  it('shows seconds for short durations', () => {
    expect(formatDuration(42_000)).toBe('42s');
  });

  it('drops leading zero units', () => {
    expect(formatDuration((3 * 60 + 5) * 1000)).toBe('3m 5s');
  });

  it('includes days, hours, minutes and seconds', () => {
    expect(formatDuration(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000)).toBe('2d 3h 4m 5s');
  });

  it('treats null and negative values as zero', () => {
    expect(formatDuration(null)).toBe('0s');
    expect(formatDuration(-5)).toBe('0s');
  });
});
