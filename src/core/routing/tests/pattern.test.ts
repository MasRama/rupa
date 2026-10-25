import { describe, expect, it } from 'vitest';
import { compilePattern } from '../pattern';

describe('compilePattern', () => {
  it('builds a custom id from params', () => {
    const route = compilePattern('moderation:ban/:userId');
    expect(route.build({ userId: '42' })).toBe('moderation:ban/42');
  });

  it('matches a custom id back into params', () => {
    const route = compilePattern('moderation:ban/:userId');
    expect(route.match('moderation:ban/42')).toEqual({ userId: '42' });
  });

  it('round-trips values containing separators and spaces', () => {
    const route = compilePattern('notes/:id/:text');
    const id = route.build({ id: '7', text: 'a/b:c d' });
    expect(route.match(id)).toEqual({ id: '7', text: 'a/b:c d' });
  });

  it('matches a pattern without params', () => {
    const route = compilePattern('moderation:cancel');
    expect(route.match('moderation:cancel')).toEqual({});
    expect(route.build({})).toBe('moderation:cancel');
  });

  it('returns null when the segment count differs', () => {
    const route = compilePattern('moderation:ban/:userId');
    expect(route.match('moderation:ban/42/extra')).toBeNull();
    expect(route.match('moderation:ban')).toBeNull();
  });

  it('returns null when a literal segment differs', () => {
    const route = compilePattern('moderation:ban/:userId');
    expect(route.match('moderation:kick/42')).toBeNull();
  });

  it('rejects empty param values when building', () => {
    const route = compilePattern('moderation:ban/:userId');
    expect(() => route.build({ userId: '' })).toThrow(/userId/);
  });

  it('throws a RangeError when the id exceeds 100 characters', () => {
    const route = compilePattern('notes/:text');
    expect(() => route.build({ text: 'x'.repeat(95) })).toThrow(RangeError);
  });

  it('rejects duplicate param names', () => {
    expect(() => compilePattern('a/:id/:id')).toThrow(/duplicate/i);
  });

  it('rejects empty segments', () => {
    expect(() => compilePattern('a//b')).toThrow(/empty segment/i);
  });
});
