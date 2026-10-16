// Where the quick-match ladder is saved (ADR-022, M7 step 7). The web keeps IndexedDB (no size cap worth worrying
// about); the toss build keeps it in the platform settings (the SDK's on-device Storage) under the Toss user's key,
// so two Toss accounts on one phone keep their own ladders. Without a key the game plays on under `local`; a ladder
// saved there, or one from the IndexedDB days, is taken over the first time it is found, and the old copy removed.
import type { QuickSave } from '@tennis/game';
import { getPlatform, type Kv } from '../platform/index.ts';

export interface QuickStore {
  loadQuick(): Promise<QuickSave | null>;
  saveQuick(file: QuickSave): Promise<void>;
}

/** An older store to take a ladder from once (IndexedDbStore). */
export interface LegacyQuick {
  loadQuick(): Promise<QuickSave | null>;
  removeQuick(): Promise<void>;
}

export const LOCAL_USER = 'local';
export const quickKey = (user: string): string => `quick:${user}`;

/** User-key attempts before playing on under `local`, and the pause between them. */
export const KEY_RETRY = { tries: 3, delayMs: 400 };

export async function resolveUserKey(
  get: () => Promise<string | null>,
  { tries, delayMs, sleep }: { tries: number; delayMs: number; sleep(ms: number): Promise<void> },
): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(delayMs);
    const key = await get();
    if (key) return key;
  }
  return null;
}

export function kvQuickStore(kv: Kv, userKey: () => Promise<string | null>, legacy: LegacyQuick | null): QuickStore {
  let user: Promise<string> | null = null;
  const who = () => (user ??= userKey().then((k) => k ?? LOCAL_USER));
  const parse = (text: string | null) => (text ? (JSON.parse(text) as QuickSave) : null);
  return {
    async loadQuick() {
      const me = await who();
      const own = parse(await kv.get(quickKey(me)));
      if (own) return own;
      if (me !== LOCAL_USER) {
        const local = await kv.get(quickKey(LOCAL_USER));
        if (local) {
          await kv.set(quickKey(me), local);
          await kv.remove(quickKey(LOCAL_USER));
          return parse(local);
        }
      }
      const old = await legacy?.loadQuick().catch(() => null);
      if (!old) return null;
      await kv.set(quickKey(me), JSON.stringify(old));
      await legacy!.removeQuick();
      return old;
    },
    async saveQuick(file) {
      await kv.set(quickKey(await who()), JSON.stringify(file));
    },
  };
}

/** The toss build's store: the platform settings, keyed by the Toss user, taking over the IndexedDB ladder once. */
export function tossQuickStore(legacy: LegacyQuick): QuickStore {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const ready = getPlatform().then((p) => kvQuickStore(p.kv, () => resolveUserKey(() => p.userKey(), { ...KEY_RETRY, sleep }), legacy));
  return {
    loadQuick: () => ready.then((s) => s.loadQuick()),
    saveQuick: (file) => ready.then((s) => s.saveQuick(file)),
  };
}
