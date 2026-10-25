import type { AppConfig } from '@/core/config';
import { openDatabase, type Database } from '@/core/database';

const SHOWN = 20;

export interface JobRow {
  id: number;
  feature: string;
  name: string;
  key: string | null;
  run_at: string;
  attempts: number;
  last_error: string | null;
}

export interface JobsReport {
  counts: Record<'pending' | 'running' | 'failed', number>;
  upcoming: JobRow[];
  failed: JobRow[];
}

const COLUMNS = 'id, feature, name, key, run_at, attempts, last_error';

export function loadJobsReport(db: Database): JobsReport {
  const counts: JobsReport['counts'] = { pending: 0, running: 0, failed: 0 };
  const rows = db.prepare('SELECT status, COUNT(*) AS n FROM rupa_jobs GROUP BY status').all() as {
    status: keyof JobsReport['counts'];
    n: number;
  }[];
  for (const { status, n } of rows) counts[status] = n;

  return {
    counts,
    upcoming: db
      .prepare(
        `SELECT ${COLUMNS} FROM rupa_jobs WHERE status != 'failed' ORDER BY run_at, id LIMIT ?`,
      )
      .all(SHOWN) as JobRow[],
    failed: db
      .prepare(
        `SELECT ${COLUMNS} FROM rupa_jobs WHERE status = 'failed' ORDER BY updated_at DESC LIMIT ?`,
      )
      .all(SHOWN) as JobRow[],
  };
}

const when = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export function formatJobsReport({ counts, upcoming, failed }: JobsReport): string {
  if (counts.pending + counts.running + counts.failed === 0) return 'No jobs scheduled.';

  const lines = [
    `Jobs: ${counts.pending} pending, ${counts.running} running, ${counts.failed} failed`,
  ];
  const id = (job: JobRow) => `#${job.id}`.padEnd(6);
  if (upcoming.length > 0) {
    lines.push('', 'Next up');
    for (const job of upcoming) {
      const key = job.key ? `  key ${job.key}` : '';
      lines.push(`  ${id(job)}  ${when(job.run_at)}  ${job.feature}/${job.name}${key}`);
    }
  }
  if (failed.length > 0) {
    lines.push('', 'Failed (kept for 30 days)');
    for (const job of failed) {
      lines.push(
        `  ${id(job)}  ${job.feature}/${job.name}  after ${job.attempts} attempts: ${job.last_error ?? 'unknown error'}`,
      );
    }
  }
  return lines.join('\n');
}

export function jobsCommand(config: AppConfig): void {
  const db = openDatabase(config.databasePath);
  try {
    console.log(formatJobsReport(loadJobsReport(db)));
  } finally {
    db.close();
  }
}
