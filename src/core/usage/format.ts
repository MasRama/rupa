const BLOCKS = '▁▂▃▄▅▆▇█';

/** One block character per value, scaled to the largest; zero stays at the floor. */
export function sparkline(values: readonly number[]): string {
  const max = Math.max(0, ...values);
  return values
    .map(value => (value <= 0 ? BLOCKS[0] : BLOCKS[Math.max(1, Math.round((value / max) * 7))]))
    .join('');
}
