import type { Database } from './sqlite';

/**
 * A forward-only schema change owned by one feature. `up` is SQL or a function
 * for changes SQL alone cannot express. Ids sort the feature's history, so
 * prefix them with a number: `001_create_warnings`.
 */
export interface Migration {
  id: string;
  up: string | ((db: Database) => void);
}

/** Anything that owns migrations; every Feature satisfies this. */
export interface MigrationSource {
  name: string;
  migrations?: readonly Migration[];
}

export interface MigrationStatusRow {
  feature: string;
  id: string;
  applied: boolean;
}

const MIGRATIONS_TABLE = 'rupa_migrations';

function ensureTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      feature    TEXT NOT NULL,
      id         TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (feature, id)
    )
  `);
}

function appliedIds(db: Database, feature: string): Set<string> {
  const rows = db
    .prepare(`SELECT id FROM ${MIGRATIONS_TABLE} WHERE feature = ?`)
    .all(feature) as { id: string }[];
  return new Set(rows.map(row => row.id));
}

function assertUniqueIds(source: MigrationSource): void {
  const seen = new Set<string>();
  for (const migration of source.migrations ?? []) {
    if (seen.has(migration.id)) {
      throw new Error(`Feature "${source.name}" has a duplicate migration id "${migration.id}"`);
    }
    seen.add(migration.id);
  }
}

/**
 * Applies pending migrations feature by feature, in declaration order. Each
 * migration runs in its own transaction; a failure rolls that migration back
 * and stops the run.
 */
export function migrate(db: Database, sources: readonly MigrationSource[]): { applied: string[] } {
  ensureTable(db);
  const applied: string[] = [];
  const record = db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (feature, id) VALUES (?, ?)`);

  for (const source of sources) {
    assertUniqueIds(source);
    const done = appliedIds(db, source.name);

    for (const migration of source.migrations ?? []) {
      if (done.has(migration.id)) continue;
      const label = `${source.name}/${migration.id}`;

      try {
        db.transaction(() => {
          if (typeof migration.up === 'string') db.exec(migration.up);
          else migration.up(db);
          record.run(source.name, migration.id);
        })();
      } catch (error) {
        throw new Error(`Migration ${label} failed: ${(error as Error).message}`, {
          cause: error,
        });
      }
      applied.push(label);
    }
  }
  return { applied };
}

export function migrationStatus(
  db: Database,
  sources: readonly MigrationSource[],
): MigrationStatusRow[] {
  ensureTable(db);
  return sources.flatMap(source => {
    const done = appliedIds(db, source.name);
    return (source.migrations ?? []).map(migration => ({
      feature: source.name,
      id: migration.id,
      applied: done.has(migration.id),
    }));
  });
}
