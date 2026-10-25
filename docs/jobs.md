# Jobs and tasks

Some work has to happen later: lift a temporary ban in seven days, deliver a reminder in an hour, post a report every morning. Rupa has two tools for it.

- A **job** is one piece of work scheduled for a moment, with a payload. It is stored in SQLite, so it survives restarts.
- A **task** is recurring work on a fixed schedule, such as every hour or every day at 09:00.

Both run inside the bot process. Rupa starts running them once Discord is ready, and waits for the running one to finish when the bot shuts down.

## Jobs

Declare a job in the feature and mount it:

```ts
// src/features/reminders/jobs.ts
import { job } from '@/core';

export const deliver = job<{ reminderId: number }>('deliver', async ({ reminderId }, ctx) => {
  const reminder = createReminderRepository(ctx.db).get(reminderId);
  if (!reminder) return; // cancelled in the meantime
  // ... send it, then delete the row
});

// src/features/reminders/index.ts
export const reminders = defineFeature({ name: 'reminders', jobs: [deliver] /* ... */ });
```

Schedule it from any handler through `ctx.jobs`:

```ts
ctx.jobs.schedule(deliver, { reminderId: 42 }, { in: '1h' }); // or '30s', '7d', '1h30m', milliseconds
ctx.jobs.schedule(deliver, { reminderId: 42 }, { at: new Date('2026-12-31T09:00:00Z') });
ctx.jobs.schedule(deliver, { reminderId: 42 }); // as soon as possible
```

The payload is stored as JSON, so keep it to plain data such as ids. Load the rest from the database when the job runs, because things change in between.

### Keys

Pass a `key` to give a job an identity within its feature. Scheduling again with the same key replaces the pending job instead of adding a second one, and `cancel` removes it:

```ts
const key = `${guildId}:${userId}`;
ctx.jobs.schedule(unban, { guildId, userId, caseId }, { in: '7d', key }); // a new ban moves the unban
ctx.jobs.cancel(unban, key); // a permanent ban drops it; returns whether there was one
```

The moderation feature uses this for temporary bans, and the reminders feature for `/remind cancel`.

### Running, retries and failure

- A due job runs once, then its row is deleted.
- If it throws, it runs again after 30 seconds, then 2 minutes, then 8 minutes, and so on (×4 each time). After its last attempt it is marked failed. The default is 3 attempts; change it with `job(name, run, { attempts: 5 })`.
- `ctx.attempt` tells the job which attempt this is, starting at 1.
- Failed jobs are kept for 30 days so you can see them with `npm run rupa -- jobs`, then deleted.
- A job whose feature is no longer mounted is marked failed with a message naming it.

Jobs run **at least once**, not exactly once. If the bot crashes while a job runs, the job runs again on the next start. Write jobs so that running twice does no harm: check that the work is still needed (the reminder still exists, the ban is still in place) before doing it.

Jobs run one at a time. A job that waits a long time holds up the others, so keep them short.

## Tasks

```ts
import { task } from '@/core';

export const cleanup = task('cleanup', { every: '1h' }, async ctx => {
  ctx.db.prepare('DELETE FROM tickets_drafts WHERE created_at < ?').run(/* ... */);
});

export const morningReport = task(
  'morning-report',
  { cron: '0 9 * * 1-5', timezone: 'Asia/Jakarta' }, // weekdays at 09:00 Jakarta time
  async ctx => {
    // ...
  },
);

export const tickets = defineFeature({
  name: 'tickets',
  tasks: [cleanup, morningReport] /* ... */,
});
```

- `every` takes a duration and counts from the last run. The first run is one interval after the bot first starts with the task.
- `cron` takes a standard five-field expression (or six, with seconds first). Without `timezone` it follows the server's local time. A bad expression or time zone throws when the feature loads, not at 09:00.
- When the next run is due is stored in `rupa_tasks`, so a restart does not reset the clock. A run missed while the bot was down happens once, right after it starts; missed runs do not pile up.
- Changing a task's schedule takes effect on the next start. A task removed from the code is forgotten.
- A task that throws is logged and runs again at its next scheduled time. Tasks are not retried.

## Seeing what is scheduled

```bash
npm run rupa -- jobs
```

```text
Jobs: 2 pending, 0 running, 1 failed

Next up
  #3      2026-10-26 12:00 UTC  moderation/unban  key 1:42
  #4      2026-10-26 12:00 UTC  reminders/deliver  key 4

Failed (kept for 30 days)
  #2      moderation/unban  after 3 attempts: Missing Permissions
```

## Limits

The scheduler is built for one bot process. It does not coordinate several processes or shards running against the same database file. A job due while the bot is offline runs as soon as it starts again.
