import { describe, expect, expectTypeOf, it } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { defineFeature } from '@/core/feature';
import { coreSchema } from '@/core/schema';
import { defineSettings, formValue, setting, SettingsError, writeSettings } from '../index';

const settings = defineSettings({
  logChannel: setting.channel({ label: 'Log channel' }),
  dmMembers: setting.boolean({ label: 'DM members', default: true }),
  prefix: setting.string({ label: 'Prefix', maxLength: 3, default: '!' }),
  maxWarnings: setting.number({ label: 'Max warnings', min: 1, max: 10, integer: true }),
  muteRole: setting.role({ label: 'Mute role' }),
});

function setup() {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema]);
  return { db, source: { db, feature: 'moderation' } };
}

const write = (db: ReturnType<typeof setup>['db'], values: Record<string, unknown>) =>
  writeSettings(db, settings, { feature: 'moderation', guildId: 'g1', values, updatedBy: 'u1' });

describe('guild settings', () => {
  it('reads defaults when nothing is stored, typed by definition', () => {
    const { source } = setup();
    const values = settings.read(source, 'g1');
    expect(values).toEqual({
      logChannel: null,
      dmMembers: true,
      prefix: '!',
      maxWarnings: null,
      muteRole: null,
    });
    expectTypeOf(values.dmMembers).toEqualTypeOf<boolean>();
    expectTypeOf(values.logChannel).toEqualTypeOf<string | null>();
    expectTypeOf(values.maxWarnings).toEqualTypeOf<number | null>();
  });

  it('reads stored values per guild and per feature', () => {
    const { db, source } = setup();
    write(db, { logChannel: '123', dmMembers: false });

    expect(settings.read(source, 'g1')).toMatchObject({ logChannel: '123', dmMembers: false });
    expect(settings.read(source, 'g2').logChannel).toBeNull();
    expect(settings.read({ db, feature: 'other' }, 'g1').logChannel).toBeNull();
  });

  it('falls back to the default when a stored value is no longer valid', () => {
    const { db, source } = setup();
    db.prepare(
      `INSERT INTO rupa_guild_settings (guild_id, feature, key, value, updated_at, updated_by)
       VALUES ('g1', 'moderation', 'prefix', '"toolong"', '2026-10-25', 'u1'),
              ('g1', 'moderation', 'dmMembers', 'not json', '2026-10-25', 'u1'),
              ('g1', 'moderation', 'removed', '1', '2026-10-25', 'u1')`,
    ).run();
    expect(settings.read(source, 'g1')).toMatchObject({ prefix: '!', dmMembers: true });
  });

  it('rejects invalid values and unknown keys, naming each, and saves nothing', () => {
    const { db, source } = setup();
    let error: unknown;
    try {
      write(db, { logChannel: '456', maxWarnings: 11, prefix: 'toolong', nope: true });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(SettingsError);
    expect((error as SettingsError).issues.map(issue => issue.key).sort()).toEqual([
      'maxWarnings',
      'nope',
      'prefix',
    ]);
    expect(settings.read(source, 'g1').logChannel).toBeNull();
  });

  it('rejects ids that are not Discord ids and fractional integers', () => {
    const { db } = setup();
    expect(() => write(db, { logChannel: 'general' })).toThrow(SettingsError);
    expect(() => write(db, { maxWarnings: 2.5 })).toThrow(SettingsError);
  });

  it('resets a setting to its default when given null', () => {
    const { db, source } = setup();
    write(db, { dmMembers: false });
    write(db, { dmMembers: null });
    expect(settings.read(source, 'g1').dmMembers).toBe(true);
  });

  it('leaves keys that are not mentioned untouched', () => {
    const { db, source } = setup();
    write(db, { logChannel: '123' });
    write(db, { dmMembers: false });
    expect(settings.read(source, 'g1')).toMatchObject({ logChannel: '123', dmMembers: false });
  });

  it('records who changed a setting and when', () => {
    const { db } = setup();
    write(db, { prefix: '?' });
    const row = db
      .prepare(`SELECT value, updated_by FROM rupa_guild_settings WHERE key = 'prefix'`)
      .get();
    expect(row).toEqual({ value: '"?"', updated_by: 'u1' });
  });

  it('can be declared on a feature', () => {
    const feature = defineFeature({ name: 'moderation', settings });
    expect(feature.settings).toBe(settings);
    expect(defineFeature({ name: 'general' }).settings).toBeNull();
  });
});

describe('formValue', () => {
  const { definitions } = settings;

  it('turns checkbox presence into a boolean', () => {
    expect(formValue(definitions.dmMembers, 'on')).toBe(true);
    expect(formValue(definitions.dmMembers, undefined)).toBe(false);
  });

  it('turns an empty field into a reset', () => {
    expect(formValue(definitions.logChannel, '')).toBeNull();
    expect(formValue(definitions.maxWarnings, '  ')).toBeNull();
  });

  it('parses numbers and keeps text as typed', () => {
    expect(formValue(definitions.maxWarnings, '3')).toBe(3);
    expect(formValue(definitions.maxWarnings, 'three')).toBe('three');
    expect(formValue(definitions.prefix, '?')).toBe('?');
  });
});
