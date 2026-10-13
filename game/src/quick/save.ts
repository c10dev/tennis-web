// Quick-match saves (ADR-016/017): the ladder state as JSON; matches are kept as recipes with their cards.
// v2 adds the rival records; a v1 save loads with none.
import { USER_ID } from '../player/create.ts';
import { rankOf, type QuickState } from './ladder.ts';

export const QUICK_VERSION = 2;

export interface QuickSave {
  quickVersion: typeof QUICK_VERSION;
  summary: { name: string; rank: number; matches: number; savedAt: string };
  state: QuickState;
}

export function toQuickSave(state: QuickState, savedAt: string): QuickSave {
  const name = state.world.players.find((p) => p.id === USER_ID)!.name;
  return { quickVersion: QUICK_VERSION, summary: { name, rank: rankOf(state), matches: state.matchNo, savedAt }, state: JSON.parse(JSON.stringify(state)) as QuickState };
}

/** Upgrades an older save's state to the current version. */
const MIGRATIONS: Record<number, (s: QuickState) => QuickState> = {
  1: (s) => ({ ...s, rivals: {} }),
  2: (s) => s,
};

export function fromQuickSave(json: unknown): QuickState {
  const file = json as { quickVersion?: unknown; state?: Partial<QuickState> } | null;
  if (typeof file !== 'object' || file === null || typeof file.quickVersion !== 'number') throw new Error('This is not a TennisSim quick-match save');
  const migrate = MIGRATIONS[file.quickVersion];
  if (!migrate) throw new Error(`This quick-match save has version ${file.quickVersion}; this game reads versions 1 to ${QUICK_VERSION}`);
  const s = file.state;
  if (!s || typeof s.matchNo !== 'number' || !Array.isArray(s.world?.players) || typeof s.points !== 'object') {
    throw new Error('This is not a TennisSim quick-match save: the ladder is missing or damaged');
  }
  return migrate(JSON.parse(JSON.stringify(s)) as QuickState);
}
