// Quick-match saves (ADR-016): the ladder state as JSON; matches are kept as recipes with their cards.
import { USER_ID } from '../player/create.ts';
import { rankOf, type QuickState } from './ladder.ts';

export const QUICK_VERSION = 1;

export interface QuickSave {
  quickVersion: typeof QUICK_VERSION;
  summary: { name: string; rank: number; matches: number; savedAt: string };
  state: QuickState;
}

export function toQuickSave(state: QuickState, savedAt: string): QuickSave {
  const name = state.world.players.find((p) => p.id === USER_ID)!.name;
  return { quickVersion: QUICK_VERSION, summary: { name, rank: rankOf(state), matches: state.matchNo, savedAt }, state: JSON.parse(JSON.stringify(state)) as QuickState };
}

export function fromQuickSave(json: unknown): QuickState {
  const file = json as Partial<QuickSave> | null;
  if (typeof file !== 'object' || file === null || typeof file.quickVersion !== 'number') throw new Error('This is not a TennisSim quick-match save');
  if (file.quickVersion !== QUICK_VERSION) throw new Error(`This quick-match save has version ${file.quickVersion}; this game reads version ${QUICK_VERSION}`);
  const s = file.state;
  if (!s || typeof s.matchNo !== 'number' || !Array.isArray(s.world?.players) || typeof s.points !== 'object') {
    throw new Error('This is not a TennisSim quick-match save: the ladder is missing or damaged');
  }
  return JSON.parse(JSON.stringify(s)) as QuickState;
}
