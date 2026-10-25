import { describe, expect, it } from 'vitest';
import { DailyChart, niceMax } from '../web/chart';

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
