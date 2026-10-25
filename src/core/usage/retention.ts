import type { Database } from '@/core/database';
import type { Logger } from '@/core/logging';
import { pruneUsage } from './store';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Prunes old usage events now and every 24 hours. Returns a function that stops it. */
export function scheduleUsagePruning(
  db: Database,
  { retentionDays, logger }: { retentionDays: number; logger: Logger },
): () => void {
  const prune = () => {
    try {
      const removed = pruneUsage(db, retentionDays);
      if (removed > 0) logger.info({ removed, retentionDays }, 'Pruned old usage events');
    } catch (error) {
      logger.warn({ err: error }, 'Could not prune usage events');
    }
  };
  prune();
  const timer = setInterval(prune, DAY_MS);
  timer.unref();
  return () => clearInterval(timer);
}
