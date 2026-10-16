// Quick-match saves (ADR-016/017): the ladder state as JSON. v2 adds the rival records (a v1 save loads with none);
// v3 keeps only the last few matches whole, with their recipes, and the rest as summaries (ADR-026).
import { USER_ID } from '../player/create.ts';
import { compactHistory } from './history.ts';
import { rankOf, type QuickState } from './ladder.ts';

export const QUICK_VERSION = 3;

export interface QuickSave {
  quickVersion: typeof QUICK_VERSION;
  summary: { name: string; rank: number; matches: number; savedAt: string };
  state: QuickState;
}

export function toQuickSave(state: QuickState, savedAt: string): QuickSave {
  const name = state.world.players.find((p) => p.id === USER_ID)!.name;
  return { quickVersion: QUICK_VERSION, summary: { name, rank: rankOf(state), matches: state.matchNo, savedAt }, state: JSON.parse(JSON.stringify(state)) as QuickState };
}

/** Upgrades a save's state from its version to the next one; applied in turn up to the current version. */
const MIGRATIONS: Record<number, (s: QuickState) => QuickState> = {
  1: (s) => ({ ...s, rivals: {} }),
  2: (s) => ({ ...s, ...compactHistory([], s.history) }),
};

export function fromQuickSave(json: unknown): QuickState {
  const file = json as { quickVersion?: unknown; state?: Partial<QuickState> } | null;
  if (typeof file !== 'object' || file === null || typeof file.quickVersion !== 'number') throw new Error('This is not a TennisSim quick-match save');
  const version = file.quickVersion;
  if (!Number.isInteger(version) || version < 1 || version > QUICK_VERSION) {
    throw new Error(`This quick-match save has version ${version}; this game reads versions 1 to ${QUICK_VERSION}`);
  }
  const s = file.state;
  if (!s || typeof s.matchNo !== 'number' || !Array.isArray(s.world?.players) || typeof s.points !== 'object' || !Array.isArray(s.history)
    || (version >= 3 && !Array.isArray(s.past))) {
    throw new Error('This is not a TennisSim quick-match save: the ladder is missing or damaged');
  }
  let state = JSON.parse(JSON.stringify(s)) as QuickState;
  for (let v = version; v < QUICK_VERSION; v++) state = MIGRATIONS[v]!(state);
  return state;
}
