import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldFeature } from '../commands/make-feature';

describe('scaffoldFeature', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'rupa-scaffold-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('creates a feature folder with a command, migrations and a test', () => {
    const created = scaffoldFeature(root, 'server-stats');

    expect(created).toEqual([
      'src/features/server-stats/index.ts',
      'src/features/server-stats/commands/server-stats.ts',
      'src/features/server-stats/migrations.ts',
      'src/features/server-stats/tests/server-stats.test.ts',
    ]);
    for (const file of created) expect(existsSync(join(root, file))).toBe(true);

    const index = readFileSync(join(root, created[0]!), 'utf8');
    expect(index).toContain("name: 'server-stats'");
    expect(index).toContain('export const serverStats = defineFeature(');
  });

  it('rejects names that are not kebab-case', () => {
    expect(() => scaffoldFeature(root, 'Server Stats')).toThrow(/kebab-case/);
  });

  it('rejects names longer than a slash command allows', () => {
    expect(() => scaffoldFeature(root, 'a'.repeat(33))).toThrow(/32/);
  });

  it('refuses to overwrite an existing feature', () => {
    scaffoldFeature(root, 'tickets');
    expect(() => scaffoldFeature(root, 'tickets')).toThrow(/already exists/);
  });
});
