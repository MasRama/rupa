import { describe, expect, it, vi } from 'vitest';
import { flushLogger } from '../index';

describe('flushLogger', () => {
  it('resolves once pino has flushed', async () => {
    const flush = vi.fn((done: (error?: Error) => void) => setImmediate(done));
    await expect(flushLogger({ flush } as never)).resolves.toBeUndefined();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('still resolves when flushing fails, so shutdown is never stuck', async () => {
    const flush = (done: (error?: Error) => void) => done(new Error('closed'));
    await expect(flushLogger({ flush } as never)).resolves.toBeUndefined();
  });
});
