const number = new Intl.NumberFormat('en-US');
const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export const formatNumber = (value: number) => number.format(value);

/** `2026-10-25` → `Oct 25`. */
export const formatDay = (day: string) => date.format(new Date(`${day}T00:00:00Z`));

export const plural = (count: number, word: string) =>
  `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`;

/** `server-stats` → `Server stats`. */
export const featureTitle = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).replaceAll('-', ' ');
