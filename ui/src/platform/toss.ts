// The Apps in Toss platform (ADR-022). Loaded only by the toss build. Until the SDK lands (M7 step 2) it behaves
// like the web platform.
import type { WebDeps } from './web.ts';
import { createWebPlatform } from './web.ts';
import type { Platform } from './types.ts';

export function createTossPlatform(deps: WebDeps): Platform {
  return { ...createWebPlatform(deps), kind: 'toss' };
}
