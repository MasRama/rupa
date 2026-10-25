import { describe, expect, it } from 'vitest';
import type { GuardContext } from '@/core';
import { stubInteraction } from '@/core/routing/tests/fixtures';
import { serverinfoCommand } from '../commands/serverinfo';
import { userinfoCommand } from '../commands/userinfo';

describe('general cooldowns', () => {
  it.each([
    ['/userinfo', userinfoCommand],
    ['/serverinfo', serverinfoCommand],
  ])('%s refuses a second use right after the first', async (target, definition) => {
    const ctx = { target, params: {} } as unknown as GuardContext;
    const run = async () => {
      const interaction = stubInteraction('command', target.slice(1)) as never;
      for (const guard of definition.guards ?? []) {
        const refusal = await guard(interaction, ctx);
        if (refusal) return refusal;
      }
      return null;
    };
    expect(await run()).toBeNull();
    expect(await run()).toMatch(/^You can use this again/);
  });
});
