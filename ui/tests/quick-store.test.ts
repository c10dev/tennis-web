import { describe, expect, it, vi } from 'vitest';
import type { QuickSave } from '@tennis/game';
import type { Kv } from '../src/platform/types.ts';
import { kvQuickStore, LOCAL_USER, quickKey, resolveUserKey, type LegacyQuick } from '../src/storage/quick-store.ts';

function memoryKv(): Kv & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => Promise.resolve(data.get(k) ?? null),
    set: (k, v) => Promise.resolve(void data.set(k, v)),
    remove: (k) => Promise.resolve(void data.delete(k)),
  };
}

const save = (name: string, matches: number) => ({ quickVersion: 2, summary: { name, rank: 40, matches, savedAt: 'x' }, state: { matchNo: matches } }) as unknown as QuickSave;

function legacy(file: QuickSave | null): LegacyQuick & { removed: boolean } {
  let held = file;
  return {
    removed: false,
    loadQuick: () => Promise.resolve(held),
    removeQuick() {
      held = null;
      this.removed = true;
      return Promise.resolve();
    },
  };
}

describe('quick saves on the platform settings (ADR-022)', () => {
  it('keeps each Toss user\'s ladder under their own key', async () => {
    const kv = memoryKv();
    const a = kvQuickStore(kv, () => Promise.resolve('hash-a'), null);
    const b = kvQuickStore(kv, () => Promise.resolve('hash-b'), null);
    await a.saveQuick(save('A', 3));
    expect(await a.loadQuick()).toEqual(save('A', 3));
    expect(await b.loadQuick()).toBeNull();
    expect([...kv.data.keys()]).toEqual([quickKey('hash-a')]);
  });

  it('plays on under the local key when there is no user key', async () => {
    const kv = memoryKv();
    const s = kvQuickStore(kv, () => Promise.resolve(null), null);
    await s.saveQuick(save('L', 1));
    expect(kv.data.has(quickKey(LOCAL_USER))).toBe(true);
    expect(await s.loadQuick()).toEqual(save('L', 1));
  });

  it('adopts a ladder saved without a key once the key arrives, then forgets the local copy', async () => {
    const kv = memoryKv();
    await kvQuickStore(kv, () => Promise.resolve(null), null).saveQuick(save('L', 4));
    const keyed = kvQuickStore(kv, () => Promise.resolve('hash-a'), null);
    expect(await keyed.loadQuick()).toEqual(save('L', 4));
    expect(kv.data.has(quickKey(LOCAL_USER))).toBe(false);
    expect(JSON.parse(kv.data.get(quickKey('hash-a'))!)).toEqual(save('L', 4));
  });

  it('moves the old browser save (IndexedDB) over once', async () => {
    const kv = memoryKv();
    const old = legacy(save('Old', 9));
    const s = kvQuickStore(kv, () => Promise.resolve('hash-a'), old);
    expect(await s.loadQuick()).toEqual(save('Old', 9));
    expect(old.removed).toBe(true);
    expect(JSON.parse(kv.data.get(quickKey('hash-a'))!)).toEqual(save('Old', 9));
    expect(await kvQuickStore(memoryKv(), () => Promise.resolve('hash-a'), old).loadQuick()).toBeNull();
  });

  it('prefers the user\'s own save over anything older', async () => {
    const kv = memoryKv();
    kv.data.set(quickKey('hash-a'), JSON.stringify(save('Mine', 2)));
    kv.data.set(quickKey(LOCAL_USER), JSON.stringify(save('Local', 7)));
    const old = legacy(save('Old', 9));
    expect(await kvQuickStore(kv, () => Promise.resolve('hash-a'), old).loadQuick()).toEqual(save('Mine', 2));
    expect(old.removed).toBe(false);
  });

  it('asks for the user key once per session', async () => {
    const key = vi.fn(() => Promise.resolve('hash-a'));
    const s = kvQuickStore(memoryKv(), key, null);
    await s.loadQuick();
    await s.saveQuick(save('A', 1));
    await s.saveQuick(save('A', 2));
    expect(key).toHaveBeenCalledTimes(1);
  });
});

describe('resolveUserKey', () => {
  it('tries a few times, a little apart, then gives up', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const get = vi.fn(() => Promise.resolve(null));
    expect(await resolveUserKey(get, { tries: 3, delayMs: 400, sleep })).toBeNull();
    expect(get).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(400);
  });

  it('stops at the first key', async () => {
    const get = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('hash-a');
    expect(await resolveUserKey(get, { tries: 3, delayMs: 1, sleep: () => Promise.resolve() })).toBe('hash-a');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
