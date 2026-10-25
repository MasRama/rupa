import { parseDuration } from '@/core';

const MAX_DAYS = 365;

/** The `duration` option of /ban: empty means permanent (0 seconds). */
export function parseBanDuration(input: string | null): { seconds: number } | { error: string } {
  if (input === null) return { seconds: 0 };
  let ms: number;
  try {
    ms = parseDuration(input);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (ms > MAX_DAYS * 24 * 60 * 60 * 1000)
    return { error: `Bans can last at most ${MAX_DAYS} days.` };
  return { seconds: Math.round(ms / 1000) };
}
