// Build targets (ADR-022): the web build (dev page, e2e, desktop) and the Apps in Toss build (`vite --mode toss`),
// which ships the quick match only: no season mode, no dev replay page.
export type Target = 'web' | 'toss';

export const targetOf = (mode: string): Target => (mode === 'toss' ? 'toss' : 'web');

export const TARGET: Target = targetOf(import.meta.env.MODE);

const WEB_ROUTES = ['', 'new', 'saves', 'quick', 'home', 'tournament', 'history', 'rankings', 'player', 'match'] as const;
const TOSS_ROUTES = ['quick'] as const;

/** What the entry point loads: the dev replay page (`?seed=`, web only) or the game. */
export function entryFor(target: Target, search: string): 'replay' | 'game' {
  return target === 'web' && new URLSearchParams(search).has('seed') ? 'replay' : 'game';
}

/** The hash routes (`#/name/…`) the target offers. */
export function routesFor(target: Target): readonly string[] {
  return target === 'toss' ? TOSS_ROUTES : WEB_ROUTES;
}

/** Where a route the target does not offer goes. */
export function landingFor(target: Target): string {
  return target === 'toss' ? '#/quick' : '#/';
}
