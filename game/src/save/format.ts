// Save files (ADR-012): the season state as JSON plus a summary for the slot list. Matches are kept as recipes,
// never as events, and replayed on demand. Other save versions are refused, not migrated.
import { USER_ID } from '../player/create.ts';
import type { SeasonState } from '../season/state.ts';

export const SAVE_VERSION = 1;

export interface SaveSummary {
  name: string;
  week: number;
  /** When it was saved, as the UI chose to write it (the game layer never reads the clock). */
  savedAt: string;
}

export interface SaveFile {
  saveVersion: typeof SAVE_VERSION;
  summary: SaveSummary;
  state: SeasonState;
}

export function toSave(state: SeasonState, savedAt: string): SaveFile {
  const name = state.world.players.find((p) => p.id === USER_ID)!.name;
  return { saveVersion: SAVE_VERSION, summary: { name, week: state.week, savedAt }, state: JSON.parse(JSON.stringify(state)) as SeasonState };
}

export function fromSave(json: unknown): SeasonState {
  const file = json as Partial<SaveFile> | null;
  if (typeof file !== 'object' || file === null || typeof file.saveVersion !== 'number') throw new Error('This is not a TennisSim save');
  if (file.saveVersion !== SAVE_VERSION) throw new Error(`This save has save version ${file.saveVersion}; this game reads version ${SAVE_VERSION}`);
  const s = file.state;
  if (!s || typeof s.week !== 'number' || !Array.isArray(s.world?.players) || typeof s.standings !== 'object') {
    throw new Error('This is not a TennisSim save: the season state is missing or damaged');
  }
  return JSON.parse(JSON.stringify(s)) as SeasonState;
}
