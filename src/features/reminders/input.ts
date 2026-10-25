import { parseDuration } from '@/core';
import type { Reminder } from './repository';

export const MAX_ACTIVE = 25;
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;
const LIST_TEXT_LENGTH = 80;

/** Works out when to remind, or why the reminder cannot be set. */
export function parseReminder(input: {
  in: string;
  now: Date;
  /** How many reminders the user already has. */
  active: number;
}): { remindAt: Date } | { error: string } {
  if (input.active >= MAX_ACTIVE) {
    return { error: `You already have ${MAX_ACTIVE} reminders. Cancel one first.` };
  }
  let delay: number;
  try {
    delay = parseDuration(input.in);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (delay > MAX_AHEAD_MS) return { error: 'Reminders can be at most 365 days ahead.' };
  return { remindAt: new Date(input.now.getTime() + delay) };
}

const shorten = (text: string) =>
  text.length > LIST_TEXT_LENGTH ? `${text.slice(0, LIST_TEXT_LENGTH - 1)}…` : text;

export function formatReminderList(items: Pick<Reminder, 'id' | 'text' | 'remindAt'>[]): string {
  if (items.length === 0) return 'You have no reminders. Set one with `/remind set`.';
  return items
    .map(item => {
      const when = `<t:${Math.floor(Date.parse(item.remindAt) / 1000)}:R>`;
      return `**#${item.id}** ${when} ${shorten(item.text)}`;
    })
    .join('\n');
}
