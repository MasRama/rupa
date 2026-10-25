import type { AppConfig } from '@/core/config';
import { migrate, migrationStatus, openDatabase } from '@/core/database';
import type { Feature } from '@/core/feature';
import { coreSchema } from '@/core/schema';

export function migrateCommand(config: AppConfig, features: readonly Feature[]): void {
  const db = openDatabase(config.databasePath);
  try {
    const { applied } = migrate(db, [coreSchema, ...features]);
    if (applied.length === 0) {
      console.log('Database is up to date.');
      return;
    }
    console.log(`Applied ${applied.length} migration(s):`);
    for (const label of applied) console.log(`  + ${label}`);
  } finally {
    db.close();
  }
}

export function migrateStatusCommand(config: AppConfig, features: readonly Feature[]): void {
  const db = openDatabase(config.databasePath);
  try {
    const rows = migrationStatus(db, [coreSchema, ...features]);
    if (rows.length === 0) {
      console.log('No migrations are declared.');
      return;
    }
    for (const row of rows) {
      console.log(`  ${row.applied ? 'applied' : 'pending'}  ${row.feature}/${row.id}`);
    }
  } finally {
    db.close();
  }
}
