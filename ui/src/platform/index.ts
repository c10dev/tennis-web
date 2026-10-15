// The platform the game runs on (ADR-022), chosen at build time: the toss build loads toss.ts on demand, so the
// web bundle never contains the Apps in Toss SDK.
import { go } from '../lib/router.ts';
import type { Platform } from './types.ts';
import { createWebPlatform, type WebDeps } from './web.ts';

export type { Haptic, Insets, Kv, Platform } from './types.ts';

function browserStorage(): WebDeps['storage'] {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let platform: Promise<Platform> | null = null;

export function getPlatform(): Promise<Platform> {
  const deps: WebDeps = { storage: browserStorage(), go };
  // The mode is compared inline (not through target.ts) so the web build drops the toss chunk and the SDK.
  platform ??= import.meta.env.MODE === 'toss'
    ? import('./toss.ts').then((m) => m.createTossPlatform(deps))
    : Promise.resolve(createWebPlatform(deps));
  return platform;
}
