import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';

export type Database = BetterSqlite3.Database;

/** Opens the SQLite database, creating its folder. `:memory:` works for tests. */
export function openDatabase(path: string): Database {
  const inMemory = path === ':memory:';
  if (!inMemory) mkdirSync(dirname(path), { recursive: true });

  const db = new BetterSqlite3(path);
  if (!inMemory) db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
