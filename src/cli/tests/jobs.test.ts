import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { coreSchema } from '@/core/schema';
import { formatJobsReport, loadJobsReport } from '../commands/jobs';

const row = (overrides: Record<string, unknown>) => ({
  id: 1,
  feature: 'moderation',
  name: 'unban',
  key: null,
  run_at: '2026-10-26T12:00:00.000Z',
  attempts: 0,
  last_error: null,
  ...overrides,
});

describe('formatJobsReport', () => {
  it('says so when nothing is scheduled', () => {
    expect(
      formatJobsReport({ counts: { pending: 0, running: 0, failed: 0 }, upcoming: [], failed: [] }),
    ).toBe('No jobs scheduled.');
  });

  it('lists upcoming and failed jobs', () => {
    const report = formatJobsReport({
      counts: { pending: 2, running: 0, failed: 1 },
      upcoming: [
        row({ id: 3, key: '1:42' }),
        row({ id: 4, name: 'deliver', feature: 'reminders' }),
      ],
      failed: [row({ id: 2, attempts: 3, last_error: 'Missing Permissions' })],
    });
    const lines = report.split('\n');
    expect(lines[0]).toBe('Jobs: 2 pending, 0 running, 1 failed');
    expect(report).toMatch(/#3\s+2026-10-26 12:00 UTC\s+moderation\/unban\s+key 1:42/);
    expect(report).toMatch(/#4\s+2026-10-26 12:00 UTC\s+reminders\/deliver/);
    expect(report).toMatch(/#2\s+moderation\/unban\s+after 3 attempts: Missing Permissions/);
  });
});

describe('loadJobsReport', () => {
  it('reads counts, the next pending jobs and failed ones', () => {
    const db = openDatabase(':memory:');
    migrate(db, [coreSchema]);
    const insert = db.prepare(
      `INSERT INTO rupa_jobs (feature, name, payload, run_at, status, attempts, last_error, created_at, updated_at)
       VALUES ('demo', 'x', '{}', ?, ?, ?, ?, '', '')`,
    );
    insert.run('2026-10-27T00:00:00.000Z', 'pending', 0, null);
    insert.run('2026-10-26T00:00:00.000Z', 'pending', 0, null);
    insert.run('2026-10-20T00:00:00.000Z', 'failed', 3, 'boom');

    const report = loadJobsReport(db);
    expect(report.counts).toEqual({ pending: 2, running: 0, failed: 1 });
    expect(report.upcoming.map(job => job.run_at)).toEqual([
      '2026-10-26T00:00:00.000Z',
      '2026-10-27T00:00:00.000Z',
    ]);
    expect(report.failed).toEqual([expect.objectContaining({ last_error: 'boom' })]);
  });
});
