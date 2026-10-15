// The Apps in Toss platform (ADR-022): the real SDK mapped onto toss-core's guarded platform. Loaded only by the
// toss build; in `vite --mode toss` dev the devtools plugin swaps the SDK for its mock.
import { Device, graniteEvent, SafeArea, Screen, Storage, User } from '@apps-in-toss/web-framework';
import { createTossPlatform as onSdk, type TossSdk } from './toss-core.ts';
import type { Platform } from './types.ts';
import { createWebPlatform, type WebDeps } from './web.ts';

const sdk: TossSdk = {
  getAnonymousKey: Object.assign(() => User.getAnonymousKey(), { isSupported: () => User.getAnonymousKey.isSupported() }),
  storage: {
    getItem: (key) => Storage.getItem(key),
    setItem: (key, value) => Storage.setItem(key, value),
    removeItem: (key) => Storage.removeItem(key),
  },
  triggerHaptic: (options) => Device.triggerHaptic(options),
  addBackListener: (handler) => graniteEvent.addEventListener('backEvent', { onEvent: handler }),
  close: () => Screen.close(),
  safeArea: { get: () => SafeArea.get(), subscribe: (args) => SafeArea.subscribe(args) },
  setOrientation: Object.assign((options: { type: 'portrait' }) => Screen.setOrientation(options), {
    isSupported: () => Screen.setOrientation.isSupported(),
  }),
};

export function createTossPlatform(deps: WebDeps): Platform {
  return onSdk(sdk, createWebPlatform(deps));
}
