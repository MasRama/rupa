/**
 * Component custom ids as routes.
 *
 * A pattern is a list of `/`-separated segments. A segment that starts with
 * `:` is a param; every other segment is matched literally. The first segment
 * usually carries a feature namespace, e.g. `moderation:ban/:userId`.
 * Param values are URI-encoded, so they may contain `/`, `:` or spaces.
 */

/** Discord rejects custom ids longer than this. */
export const MAX_CUSTOM_ID_LENGTH = 100;

type ParamName<Segment extends string> = Segment extends `:${infer Name}`
  ? Name
  : never;

type ParamNames<Pattern extends string> =
  Pattern extends `${infer Segment}/${infer Rest}`
    ? ParamName<Segment> | ParamNames<Rest>
    : ParamName<Pattern>;

/** Params object inferred from a pattern: `'a/:id'` → `{ id: string }`. */
export type RouteParams<Pattern extends string> = {
  [Name in ParamNames<Pattern>]: string;
};

export interface CompiledPattern<Pattern extends string> {
  readonly pattern: Pattern;
  build(params: RouteParams<Pattern>): string;
  match(customId: string): RouteParams<Pattern> | null;
}

type Segment = { kind: 'literal'; value: string } | { kind: 'param'; name: string };

export function compilePattern<Pattern extends string>(
  pattern: Pattern,
): CompiledPattern<Pattern> {
  const seen = new Set<string>();
  const segments: Segment[] = pattern.split('/').map(raw => {
    if (raw === '') {
      throw new Error(`Invalid route pattern "${pattern}": empty segment`);
    }
    if (!raw.startsWith(':')) return { kind: 'literal', value: raw };

    const name = raw.slice(1);
    if (name === '') {
      throw new Error(`Invalid route pattern "${pattern}": unnamed param`);
    }
    if (seen.has(name)) {
      throw new Error(
        `Invalid route pattern "${pattern}": duplicate param "${name}"`,
      );
    }
    seen.add(name);
    return { kind: 'param', name };
  });

  return {
    pattern,

    build(params) {
      const values = params as Record<string, string>;
      const id = segments
        .map(segment => {
          if (segment.kind === 'literal') return segment.value;
          const value = values[segment.name];
          if (value === undefined || value === '') {
            throw new Error(
              `Route "${pattern}" needs a value for param "${segment.name}"`,
            );
          }
          return encodeURIComponent(value);
        })
        .join('/');

      if (id.length > MAX_CUSTOM_ID_LENGTH) {
        throw new RangeError(
          `Custom id for "${pattern}" is ${id.length} characters; Discord allows ${MAX_CUSTOM_ID_LENGTH}`,
        );
      }
      return id;
    },

    match(customId) {
      const parts = customId.split('/');
      if (parts.length !== segments.length) return null;

      const params: Record<string, string> = {};
      for (const [index, segment] of segments.entries()) {
        const part = parts[index]!;
        if (segment.kind === 'literal') {
          if (part !== segment.value) return null;
          continue;
        }
        try {
          params[segment.name] = decodeURIComponent(part);
        } catch {
          return null;
        }
      }
      return params as RouteParams<Pattern>;
    },
  };
}
