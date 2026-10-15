import { describe, expect, it, vi } from 'vitest';
import { createWebPlatform } from '../src/platform/web.ts';

/** A Storage stand-in; `broken` throws like a private window that refuses storage. */
function memoryStorage(broken = false): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const data = new Map<string, string>();
  const guard = () => {
    if (broken) throw new Error('SecurityError');
  };
  return {
    getItem: (k) => (guard(), data.get(k) ?? null),
    setItem: (k, v) => (guard(), void data.set(k, v)),
    removeItem: (k) => (guard(), void data.delete(k)),
  };
}

describe('web platform (ADR-022)', () => {
  it('keeps small settings in the given storage', async () => {
    const p = createWebPlatform({ storage: memoryStorage(), go: () => undefined });
    expect(p.kind).toBe('web');
    expect(await p.kv.get('k')).toBeNull();
    await p.kv.set('k', 'v');
    expect(await p.kv.get('k')).toBe('v');
    await p.kv.remove('k');
    expect(await p.kv.get('k')).toBeNull();
  });

  it('acts like an empty store when storage is refused', async () => {
    const p = createWebPlatform({ storage: memoryStorage(true), go: () => undefined });
    await expect(p.kv.set('k', 'v')).resolves.toBeUndefined();
    expect(await p.kv.get('k')).toBeNull();
    await expect(p.kv.remove('k')).resolves.toBeUndefined();
  });

  it('has no user key, haptics, back button or orientation lock, and closes to the title', async () => {
    const go = vi.fn();
    const p = createWebPlatform({ storage: memoryStorage(), go });
    expect(await p.userKey()).toBeNull();
    expect(() => p.haptic('tap')).not.toThrow();
    const off = p.onBack(() => undefined);
    expect(typeof off).toBe('function');
    off();
    const insets = vi.fn();
    p.safeArea(insets)();
    expect(insets).not.toHaveBeenCalled();
    await expect(p.lockPortrait()).resolves.toBeUndefined();
    await p.close();
    expect(go).toHaveBeenCalledWith('#/');
  });
});
