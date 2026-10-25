import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../sqlite';
import { migrate, migrationStatus, type MigrationSource } from '../migrator';

const notes: MigrationSource = {
  name: 'notes',
  migrations: [
    { id: '001_create_notes', up: 'CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)' },
    {
      id: '002_add_author',
      up: db => db.exec('ALTER TABLE notes ADD COLUMN author TEXT'),
    },
  ],
};

const tableExists = (db: ReturnType<typeof openDatabase>, name: string) =>
  db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) !== undefined;

describe('migrate', () => {
  it('applies pending migrations once, in order', () => {
    const db = openDatabase(':memory:');
    expect(migrate(db, [notes]).applied).toEqual([
      'notes/001_create_notes',
      'notes/002_add_author',
    ]);
    expect(migrate(db, [notes]).applied).toEqual([]);
    db.prepare('INSERT INTO notes (body, author) VALUES (?, ?)').run('hi', 'ren');
  });

  it('skips features without migrations', () => {
    const db = openDatabase(':memory:');
    expect(migrate(db, [{ name: 'empty' }]).applied).toEqual([]);
  });

  it('rolls back a failing migration and does not record it', () => {
    const db = openDatabase(':memory:');
    const broken: MigrationSource = {
      name: 'broken',
      migrations: [
        { id: '001_ok', up: 'CREATE TABLE ok_table (id INTEGER)' },
        {
          id: '002_fails',
          up: 'CREATE TABLE half_table (id INTEGER); INSERT INTO missing VALUES (1);',
        },
      ],
    };

    expect(() => migrate(db, [broken])).toThrow(/broken\/002_fails/);
    expect(tableExists(db, 'ok_table')).toBe(true);
    expect(tableExists(db, 'half_table')).toBe(false);
    expect(
      migrationStatus(db, [broken]).map(row => [row.id, row.applied]),
    ).toEqual([
      ['001_ok', true],
      ['002_fails', false],
    ]);
  });

  it('rejects duplicate migration ids in one feature', () => {
    const db = openDatabase(':memory:');
    const duplicated: MigrationSource = {
      name: 'dup',
      migrations: [
        { id: '001_a', up: 'SELECT 1' },
        { id: '001_a', up: 'SELECT 1' },
      ],
    };
    expect(() => migrate(db, [duplicated])).toThrow(/duplicate/i);
  });
});

describe('migrationStatus', () => {
  it('reports pending and applied migrations per feature', () => {
    const db = openDatabase(':memory:');
    expect(migrationStatus(db, [notes])).toEqual([
      { feature: 'notes', id: '001_create_notes', applied: false },
      { feature: 'notes', id: '002_add_author', applied: false },
    ]);
    migrate(db, [notes]);
    expect(migrationStatus(db, [notes]).every(row => row.applied)).toBe(true);
  });
});

describe('openDatabase', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('enables foreign keys', () => {
    const db = openDatabase(':memory:');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('creates the parent folder and uses WAL for file databases', () => {
    dir = mkdtempSync(join(tmpdir(), 'rupa-db-'));
    const db = openDatabase(join(dir, 'nested', 'bot.db'));
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.close();
  });
});
