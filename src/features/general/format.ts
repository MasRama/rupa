const UNITS = [
  ['d', 86_400],
  ['h', 3_600],
  ['m', 60],
  ['s', 1],
] as const;

/** `2d 3h 4m 5s`, leaving out leading zero units. */
export function formatDuration(milliseconds: number | null): string {
  let remaining = Math.max(0, Math.floor((milliseconds ?? 0) / 1000));
  const parts: string[] = [];
  for (const [unit, seconds] of UNITS) {
    const value = Math.floor(remaining / seconds);
    remaining %= seconds;
    if (value > 0 || parts.length > 0) parts.push(`${value}${unit}`);
  }
  return parts.length > 0 ? parts.join(' ') : '0s';
}

/** Discord timestamp markup, rendered in each reader's timezone. */
export const relativeTime = (timestamp: number) => `<t:${Math.floor(timestamp / 1000)}:R>`;
