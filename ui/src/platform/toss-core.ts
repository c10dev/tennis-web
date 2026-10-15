// The Apps in Toss platform over an SDK-shaped object (ADR-022), so it runs in Node tests without the SDK. Every
// call is guarded: a Toss app too old for a call, a bridge that throws, rejects or never answers (a plain browser)
// falls back to the web behaviour, and nothing here ever throws into a screen.
import type { Haptic, Insets, Kv, Platform } from './types.ts';

/** How long a bridge call may take before the web behaviour takes over. */
export const SDK_TIMEOUT_MS = 3000;

type Supported = { isSupported(): boolean };

/** The parts of `@apps-in-toss/web-framework` the game uses (toss.ts maps the real SDK onto this). */
export interface TossSdk {
  getAnonymousKey: (() => Promise<{ hash: string }>) & Supported;
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  triggerHaptic(options: { type: Haptic }): Promise<void>;
  addBackListener(handler: () => void): () => void;
  close(): Promise<void>;
  safeArea: { get(): Insets; subscribe(args: { onEvent(insets: Insets): void }): () => void };
  setOrientation: ((options: { type: 'portrait' }) => Promise<void>) & Supported;
}

/** Runs a bridge call; a throw, a rejection or no answer within the timeout gives the fallback instead. */
function guarded<T>(call: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('The Toss bridge did not answer')), SDK_TIMEOUT_MS);
  });
  const attempt = (async () => call())();
  return Promise.race([attempt, late]).catch(fallback).finally(() => clearTimeout(timer));
}

function attempt<T>(call: () => T, fallback: () => T): T {
  try {
    return call();
  } catch {
    return fallback();
  }
}

export function createTossPlatform(sdk: TossSdk, web: Platform): Platform {
  const kv: Kv = {
    get: (key) => guarded(() => sdk.storage.getItem(key), () => web.kv.get(key)),
    set: (key, value) => guarded(() => sdk.storage.setItem(key, value), () => web.kv.set(key, value)),
    remove: (key) => guarded(() => sdk.storage.removeItem(key), () => web.kv.remove(key)),
  };
  let key: Promise<string | null> | null = null;
  const none = () => Promise.resolve(null);
  return {
    kind: 'toss',
    userKey() {
      key ??= attempt(() => sdk.getAnonymousKey.isSupported(), () => false)
        ? guarded(async () => (await sdk.getAnonymousKey()).hash, none)
        : none();
      return key;
    },
    kv,
    haptic(type) {
      void guarded(() => sdk.triggerHaptic({ type }), () => Promise.resolve());
    },
    onBack: (handler) => attempt(() => sdk.addBackListener(handler), () => web.onBack(handler)),
    close: () => guarded(() => sdk.close(), () => web.close()),
    safeArea(handler) {
      return attempt(() => {
        handler(sdk.safeArea.get());
        return sdk.safeArea.subscribe({ onEvent: handler });
      }, () => web.safeArea(handler));
    },
    async lockPortrait() {
      if (attempt(() => sdk.setOrientation.isSupported(), () => false)) await guarded(() => sdk.setOrientation({ type: 'portrait' }), () => Promise.resolve());
    },
  };
}
