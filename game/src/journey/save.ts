// Text-career saves (ADR-032): the whole state as JSON with a version, so a file exported on one device loads on
// another; later versions add migrations here, as quick/save.ts does.
import { ovr } from './ratings.ts';
import { rankOf } from './ranking.ts';
import type { CareerSummary } from './summary.ts';
import type { JourneyState, Stage } from './types.ts';

export const JOURNEY_VERSION = 1;

export interface JourneySave {
  journeyVersion: typeof JOURNEY_VERSION;
  summary: { name: string; age: number; year: number; stage: Stage; rank: number | null; ovr: number; savedAt: string };
  state: JourneyState;
}

export function toJourneySave(state: JourneyState, savedAt: string): JourneySave {
  const p = state.user.player;
  return {
    journeyVersion: JOURNEY_VERSION,
    summary: { name: p.name, age: p.age, year: state.year, stage: state.user.stage, rank: rankOf(p, state.pros, state.points), ovr: ovr(p), savedAt },
    state: JSON.parse(JSON.stringify(state)) as JourneyState,
  };
}

/** Upgrades a save's state from its version to the next one; applied in turn up to the current version. */
const MIGRATIONS: Record<number, (s: JourneyState) => JourneyState> = {};

export function fromJourneySave(json: unknown): JourneyState {
  const file = json as { journeyVersion?: unknown; state?: Partial<JourneyState> } | null;
  if (typeof file !== 'object' || file === null || typeof file.journeyVersion !== 'number') throw new Error('테니스 커리어 저장 파일이 아니에요');
  const version = file.journeyVersion;
  if (!Number.isInteger(version) || version < 1 || version > JOURNEY_VERSION) {
    throw new Error(`이 저장 파일은 버전 ${version}이에요. 이 게임은 1–${JOURNEY_VERSION} 버전을 읽어요`);
  }
  const s = file.state;
  if (!s || typeof s.seed !== 'number' || typeof s.year !== 'number' || !s.user?.player || !Array.isArray(s.pros) || !Array.isArray(s.juniors)
    || typeof s.points !== 'object' || !Array.isArray(s.reports) || !Array.isArray(s.pending)) {
    throw new Error('저장 파일이 손상됐어요');
  }
  let state = JSON.parse(JSON.stringify(s)) as JourneyState;
  for (let v = version; v < JOURNEY_VERSION; v++) state = MIGRATIONS[v]!(state);
  return state;
}

/** A retired career kept in the hall of fame. */
export interface HallEntry extends CareerSummary {
  seed: number;
  savedAt: string;
}

/** The hall of fame best first: majors, best rank, titles. */
export function sortHall(entries: readonly HallEntry[]): HallEntry[] {
  return [...entries].sort((a, b) => b.majors - a.majors || (a.bestRank ?? 9999) - (b.bestRank ?? 9999) || b.titles - a.titles || (a.savedAt < b.savedAt ? -1 : 1));
}
