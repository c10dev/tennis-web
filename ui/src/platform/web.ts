// The plain-browser platform (ADR-022): settings in localStorage, no user key, haptics or back button.
import type { Kv, Platform } from './types.ts';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface WebDeps {
  storage: Store | null;
  go(path: string): void;
}

/** Private windows may refuse storage; settings then last for this page only. */
function storageKv(storage: Store | null): Kv {
  const attempt = <T>(fn: (s: Store) => T, fallback: T): Promise<T> => {
    try {
      return Promise.resolve(storage ? fn(storage) : fallback);
    } catch {
      return Promise.resolve(fallback);
    }
  };
  return {
    get: (key) => attempt((s) => s.getItem(key), null),
    set: (key, value) => attempt((s) => s.setItem(key, value), undefined),
    remove: (key) => attempt((s) => s.removeItem(key), undefined),
  };
}

const none = () => undefined;

export function createWebPlatform({ storage, go }: WebDeps): Platform {
  return {
    kind: 'web',
    userKey: () => Promise.resolve(null),
    kv: storageKv(storage),
    haptic: none,
    onBack: () => none,
    close: () => Promise.resolve(go('#/')),
    safeArea: () => none,
    lockPortrait: () => Promise.resolve(),
  };
}
