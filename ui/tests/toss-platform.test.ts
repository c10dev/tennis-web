import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTossPlatform, SDK_TIMEOUT_MS, type TossSdk } from '../src/platform/toss-core.ts';
import { createWebPlatform } from '../src/platform/web.ts';
import type { Platform } from '../src/platform/types.ts';

const supported = <F extends (...a: never[]) => unknown>(fn: F, ok = true) => Object.assign(fn, { isSupported: () => ok });

/** An SDK stand-in that works like the Toss app; override pieces to break them. */
function fakeSdk(over: Partial<TossSdk> = {}): TossSdk {
  const data = new Map<string, string>();
  return {
    getAnonymousKey: supported(() => Promise.resolve({ hash: 'h-123', type: 'HASH' as const })),
    storage: {
      getItem: (k) => Promise.resolve(data.get(k) ?? null),
      setItem: (k, v) => Promise.resolve(void data.set(k, v)),
      removeItem: (k) => Promise.resolve(void data.delete(k)),
    },
    triggerHaptic: vi.fn(() => Promise.resolve()),
    addBackListener: vi.fn(() => vi.fn()),
    close: vi.fn(() => Promise.resolve()),
    safeArea: { get: () => ({ top: 47, right: 0, bottom: 34, left: 0 }), subscribe: vi.fn(() => vi.fn()) },
    setOrientation: supported(vi.fn(() => Promise.resolve())),
    ...over,
  };
}

const fallback = (go = vi.fn()): Platform => createWebPlatform({ storage: null, go });
const boom = () => {
  throw new Error('no bridge');
};

describe('toss platform on the SDK (ADR-022)', () => {
  afterEach(() => vi.useRealTimers());

  it('uses the SDK when the Toss app answers', async () => {
    const sdk = fakeSdk();
    const p = createTossPlatform(sdk, fallback());
    expect(p.kind).toBe('toss');
    expect(await p.userKey()).toBe('h-123');
    await p.kv.set('k', 'v');
    expect(await p.kv.get('k')).toBe('v');
    await p.kv.remove('k');
    expect(await p.kv.get('k')).toBeNull();
    p.haptic('confetti');
    expect(sdk.triggerHaptic).toHaveBeenCalledWith({ type: 'confetti' });
    const back = vi.fn();
    p.onBack(back);
    expect(sdk.addBackListener).toHaveBeenCalledWith(back);
    await p.close();
    expect(sdk.close).toHaveBeenCalled();
    await p.lockPortrait();
    expect(sdk.setOrientation).toHaveBeenCalledWith({ type: 'portrait' });
  });

  it('reports the safe area at once, then on every change', () => {
    const sdk = fakeSdk();
    const seen = vi.fn();
    createTossPlatform(sdk, fallback()).safeArea(seen);
    expect(seen).toHaveBeenCalledWith({ top: 47, right: 0, bottom: 34, left: 0 });
    expect(sdk.safeArea.subscribe).toHaveBeenCalledWith({ onEvent: seen });
  });

  it('has no user key and skips the orientation lock on a Toss app too old for them', async () => {
    const getAnonymousKey = supported(vi.fn(() => Promise.resolve({ hash: 'x', type: 'HASH' as const })), false);
    const setOrientation = supported(vi.fn(() => Promise.resolve()), false);
    const p = createTossPlatform(fakeSdk({ getAnonymousKey, setOrientation }), fallback());
    expect(await p.userKey()).toBeNull();
    await p.lockPortrait();
    expect(getAnonymousKey).not.toHaveBeenCalled();
    expect(setOrientation).not.toHaveBeenCalled();
  });

  it('falls back to the web behaviour when the SDK throws or rejects', async () => {
    const go = vi.fn();
    const sdk = fakeSdk({
      getAnonymousKey: supported(() => Promise.reject(new Error('UNKNOWN_ERROR'))),
      storage: { getItem: boom, setItem: () => Promise.reject(new Error('x')), removeItem: boom },
      triggerHaptic: () => Promise.reject(new Error('x')),
      addBackListener: boom,
      close: () => Promise.reject(new Error('x')),
      safeArea: { get: boom, subscribe: boom },
      setOrientation: supported(() => Promise.reject(new Error('UNSUPPORTED_APP_VERSION'))),
    });
    const p = createTossPlatform(sdk, fallback(go));
    expect(await p.userKey()).toBeNull();
    expect(await p.kv.get('k')).toBeNull();
    await expect(p.kv.set('k', 'v')).resolves.toBeUndefined();
    await expect(p.kv.remove('k')).resolves.toBeUndefined();
    expect(() => p.haptic('tap')).not.toThrow();
    expect(typeof p.onBack(() => undefined)).toBe('function');
    expect(typeof p.safeArea(() => undefined)).toBe('function');
    await expect(p.lockPortrait()).resolves.toBeUndefined();
    await p.close();
    expect(go).toHaveBeenCalledWith('#/');
  });

  it('gives up on a bridge that never answers', async () => {
    vi.useFakeTimers();
    const never = () => new Promise<never>(() => undefined);
    const p = createTossPlatform(fakeSdk({ getAnonymousKey: supported(never), storage: { getItem: never, setItem: never, removeItem: never } }), fallback());
    const key = p.userKey();
    const value = p.kv.get('k');
    await vi.advanceTimersByTimeAsync(SDK_TIMEOUT_MS);
    expect(await key).toBeNull();
    expect(await value).toBeNull();
  });

  it('asks the Toss app for the user key once', async () => {
    const getAnonymousKey = supported(vi.fn(() => Promise.resolve({ hash: 'h', type: 'HASH' as const })));
    const p = createTossPlatform(fakeSdk({ getAnonymousKey }), fallback());
    await Promise.all([p.userKey(), p.userKey()]);
    await p.userKey();
    expect(getAnonymousKey).toHaveBeenCalledTimes(1);
  });
});
