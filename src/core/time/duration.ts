const UNITS = {
  w: 7 * 24 * 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  m: 60 * 1000,
  s: 1000,
} as const;

type Unit = keyof typeof UNITS;

const DURATION = /^(\d+[wdhms])+$/;
const PART = /(\d+)([wdhms])/g;
const INVALID = 'Use a duration like 30s, 10m, 2h, 7d or 1h30m';

/** `30s`, `10m`, `2h`, `7d`, `1w` or combinations like `1h30m`, in milliseconds. */
export function parseDuration(input: string): number {
  const text = input.trim().toLowerCase();
  if (!DURATION.test(text)) throw new RangeError(INVALID);
  let ms = 0;
  for (const [, amount, unit] of text.matchAll(PART)) {
    ms += Number(amount) * UNITS[unit as Unit];
  }
  if (ms <= 0) throw new RangeError(INVALID);
  return ms;
}

/** The two largest units, e.g. `1h 30m`, `7d`, `45s`. Weeks are shown as days. */
export function formatDuration(ms: number): string {
  const parts: string[] = [];
  let rest = Math.max(0, ms);
  for (const unit of ['d', 'h', 'm', 's'] as const) {
    const amount = Math.floor(rest / UNITS[unit]);
    rest -= amount * UNITS[unit];
    if (amount > 0) parts.push(`${amount}${unit}`);
    if (parts.length === 2) break;
  }
  return parts.length === 0 ? '0s' : parts.join(' ');
}
