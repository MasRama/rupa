import { job } from '@/core';
import { createReminderRepository } from './repository';

/** Posts a reminder where it was set, or as a DM when that channel is out of reach. */
export const deliver = job<{ reminderId: number }>('deliver', async ({ reminderId }, ctx) => {
  const reminders = createReminderRepository(ctx.db);
  const reminder = reminders.get(reminderId);
  if (!reminder) return; // Cancelled.

  const text = `Reminder: ${reminder.text}`;
  let delivered = false;
  try {
    const channel = await ctx.client.channels.fetch(reminder.channelId);
    if (channel?.isSendable()) {
      await channel.send({
        content: `<@${reminder.userId}> ${text}`,
        allowedMentions: { users: [reminder.userId] },
      });
      delivered = true;
    }
  } catch (error) {
    ctx.logger.debug({ err: error, reminderId }, 'Could not post a reminder in its channel');
  }
  // A DM that fails throws, so the runner retries the job later.
  if (!delivered) await (await ctx.client.users.fetch(reminder.userId)).send(text);

  reminders.delete(reminderId);
});
