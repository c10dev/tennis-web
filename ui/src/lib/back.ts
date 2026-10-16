// The back button (ADR-022, M7 step 8): what it does on each quick screen. Pure; career/back.ts carries it out.
import type { Route } from './router.ts';

export type BackAction = 'close-modal' | 'confirm-concede' | 'ladder' | 'confirm-exit' | 'none';

export function backAction(route: Route, modalOpen: boolean): BackAction {
  if (modalOpen) return 'close-modal';
  if (route.name !== 'quick') return 'none';
  if (route.params[0] === 'match') return 'confirm-concede';
  if (route.params[0] === 'result') return 'ladder';
  return 'confirm-exit';
}
