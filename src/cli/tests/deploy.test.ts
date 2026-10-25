import { describe, expect, it, vi } from 'vitest';
import { fetchRemoteCommands } from '../commands/deploy';

describe('fetchRemoteCommands', () => {
  it('asks Discord for localizations so localized commands are compared fully', async () => {
    const get = vi.fn(async () => []);
    await fetchRemoteCommands({ get }, '/applications/1/commands');

    const [route, options] = get.mock.calls[0] as unknown as [string, { query: URLSearchParams }];
    expect(route).toBe('/applications/1/commands');
    expect(options.query.get('with_localizations')).toBe('true');
  });
});
