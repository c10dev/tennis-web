// The platform the game runs on (ADR-022), chosen at build time: the toss build loads toss.ts on demand, so the
// web bundle never contains the Apps in Toss SDK.
import { go } from '../lib/router.ts';
import { TARGET } from '../target.ts';
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
  platform ??= TARGET === 'toss'
    ? import('./toss.ts').then((m) => m.createTossPlatform(deps))
    : Promise.resolve(createWebPlatform(deps));
  return platform;
}
