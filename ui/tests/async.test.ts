import { afterEach, describe, expect, it, vi } from 'vitest';
import { within } from '../src/lib/async.ts';

describe('within', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves when the promise does, or after the time limit if it never settles (a lost WebGL context)', async () => {
    vi.useFakeTimers();
    let done = false;
    void within(new Promise<void>(() => {}), 1500).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(1499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    await expect(within(Promise.resolve(), 1500)).resolves.toBeUndefined();
    await expect(within(Promise.reject(new Error('lost')), 1500)).resolves.toBeUndefined();
  });
});
