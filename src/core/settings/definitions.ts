import { z } from 'zod';

export type SettingKind = 'string' | 'number' | 'boolean' | 'channel' | 'role';

interface BaseOptions<T> {
  label: string;
  description?: string;
  /** Used when the server has not chosen a value. Without it the value is `null`. */
  default?: T;
}

/** One configurable value. `Read` is what `read()` returns for it. */
export interface SettingDefinition<T = unknown, Read = T | null> {
  readonly kind: SettingKind;
  readonly label: string;
  readonly description: string | null;
  readonly default: Read;
  readonly schema: z.ZodType<T>;
  /** Limits a form can show next to the input. */
  readonly constraints: { maxLength?: number; min?: number; max?: number; integer?: boolean };
}

type ReadType<T, Options> = Options extends { default: T } ? T : T | null;

const SNOWFLAKE = /^\d+$/;

function define<T, Options extends BaseOptions<T>>(
  kind: SettingKind,
  options: Options,
  schema: z.ZodType<T>,
  constraints: SettingDefinition['constraints'] = {},
): SettingDefinition<T, ReadType<T, Options>> {
  return Object.freeze({
    kind,
    label: options.label,
    description: options.description ?? null,
    default: (options.default ?? null) as ReadType<T, Options>,
    schema,
    constraints,
  });
}

export const setting = {
  string<O extends BaseOptions<string> & { maxLength?: number }>(options: O) {
    const schema =
      options.maxLength === undefined
        ? z.string()
        : z.string().max(options.maxLength, `Must be at most ${options.maxLength} characters`);
    return define<string, O>('string', options, schema, { maxLength: options.maxLength });
  },

  number<O extends BaseOptions<number> & { min?: number; max?: number; integer?: boolean }>(
    options: O,
  ) {
    let schema = z.number('Must be a number');
    if (options.integer) schema = schema.int('Must be a whole number');
    if (options.min !== undefined)
      schema = schema.min(options.min, `Must be at least ${options.min}`);
    if (options.max !== undefined)
      schema = schema.max(options.max, `Must be at most ${options.max}`);
    return define<number, O>('number', options, schema, {
      min: options.min,
      max: options.max,
      integer: options.integer,
    });
  },

  boolean<O extends BaseOptions<boolean>>(options: O) {
    return define<boolean, O>('boolean', options, z.boolean('Must be on or off'));
  },

  /** A text channel in the server, stored as its id. */
  channel<O extends BaseOptions<string>>(options: O) {
    return define<string, O>(
      'channel',
      options,
      z.string().regex(SNOWFLAKE, 'Must be a channel id'),
    );
  },

  /** A role in the server, stored as its id. */
  role<O extends BaseOptions<string>>(options: O) {
    return define<string, O>('role', options, z.string().regex(SNOWFLAKE, 'Must be a role id'));
  },
};

/**
 * Converts what an HTML form sent into a value for `writeSettings`: checkbox
 * presence becomes a boolean, an empty field becomes `null` (reset), and
 * numbers are parsed. Anything unparsable is passed on for validation to reject.
 */
export function formValue(definition: SettingDefinition, raw: string | undefined): unknown {
  if (definition.kind === 'boolean') return raw !== undefined && raw !== '' && raw !== 'false';
  if (raw === undefined || raw.trim() === '') return null;
  if (definition.kind === 'number') {
    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) ? parsed : raw;
  }
  return definition.kind === 'string' ? raw : raw.trim();
}
