import type { Database } from '@/core/database';
import type { SettingDefinition } from './definitions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SettingDefinitions = Record<string, SettingDefinition<any, any>>;

export type SettingValues<D extends SettingDefinitions> = {
  -readonly [Key in keyof D]: D[Key] extends SettingDefinition<unknown, infer Read> ? Read : never;
};

/** Where settings are read from: a handler context fits, or `{ db, feature }`. */
export interface SettingsSource {
  db: Database;
  feature: string;
}

export interface Settings<D extends SettingDefinitions = SettingDefinitions> {
  readonly definitions: D;
  /** Every setting for one server, with defaults filled in. */
  read(source: SettingsSource, guildId: string): SettingValues<D>;
}

export class SettingsError extends Error {
  constructor(readonly issues: { key: string; message: string }[]) {
    super(`Invalid settings: ${issues.map(issue => `${issue.key} ${issue.message}`).join('; ')}`);
    this.name = 'SettingsError';
  }
}

export function defineSettings<D extends SettingDefinitions>(definitions: D): Settings<D> {
  return Object.freeze({
    definitions,
    read({ db, feature }: SettingsSource, guildId: string) {
      const rows = db
        .prepare('SELECT key, value FROM rupa_guild_settings WHERE guild_id = ? AND feature = ?')
        .all(guildId, feature) as { key: string; value: string }[];
      const stored = new Map(rows.map(row => [row.key, row.value]));

      const values: Record<string, unknown> = {};
      for (const [key, definition] of Object.entries(definitions)) {
        values[key] = definition.default;
        const raw = stored.get(key);
        if (raw === undefined) continue;
        try {
          const parsed = definition.schema.safeParse(JSON.parse(raw));
          if (parsed.success) values[key] = parsed.data;
        } catch {
          // Unreadable JSON: keep the default.
        }
      }
      return values as SettingValues<D>;
    },
  });
}

export interface SettingsWrite {
  feature: string;
  guildId: string;
  /** Keys to change; `null` resets a key to its default. Keys left out are untouched. */
  values: Record<string, unknown>;
  /** Discord user id of whoever made the change. */
  updatedBy: string;
}

/** Validates every value, then saves them all in one transaction. Throws SettingsError. */
export function writeSettings(
  db: Database,
  settings: Settings,
  { feature, guildId, values, updatedBy }: SettingsWrite,
): void {
  const issues: SettingsError['issues'] = [];
  const changes: { key: string; value: string | null }[] = [];

  for (const [key, value] of Object.entries(values)) {
    const definition = settings.definitions[key];
    if (!definition) {
      issues.push({ key, message: 'is not a setting' });
      continue;
    }
    if (value === null) {
      changes.push({ key, value: null });
      continue;
    }
    const parsed = definition.schema.safeParse(value);
    if (parsed.success) changes.push({ key, value: JSON.stringify(parsed.data) });
    else issues.push({ key, message: parsed.error.issues[0]?.message ?? 'is invalid' });
  }
  if (issues.length > 0) throw new SettingsError(issues);

  const remove = db.prepare(
    'DELETE FROM rupa_guild_settings WHERE guild_id = ? AND feature = ? AND key = ?',
  );
  const upsert = db.prepare(`
    INSERT INTO rupa_guild_settings (guild_id, feature, key, value, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (guild_id, feature, key)
    DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `);
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const { key, value } of changes) {
      if (value === null) remove.run(guildId, feature, key);
      else upsert.run(guildId, feature, key, value, now, updatedBy);
    }
  })();
}
