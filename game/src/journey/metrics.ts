// Balance metrics for the text career (ADR-032, journey-design.md §8): careers played by the autoplayer, measured.
import { playCareer, type Policy } from './autoplay.ts';
import { candidates, GROUPS, type CreatableStyle } from './ratings.ts';
import { newJourney } from './start.ts';
import type { Load } from './types.ts';

export interface CareerRun {
  bestRank: number | null;
  majors: number;
  titles: number;
  swingsAtOne: number;
  retiredAt: number;
  swings: number;
  potential: number;
  peakOvr: number;
}

const STYLES: readonly CreatableStyle[] = ['big_server', 'baseliner', 'counter_puncher', 'all_court'];

export function runCareer(seed: number, load: Load = 'normal', policy?: Policy): CareerRun {
  const style = STYLES[seed % STYLES.length]!;
  const pick = candidates(seed, { name: '테스트', nation: 'KOR', style })[seed % 3]!;
  const focus = [GROUPS[seed % GROUPS.length]!, GROUPS[(seed + 2) % GROUPS.length]!];
  const start = newJourney({ seed, player: pick, hand: 'right', focus });
  const { state, swings } = playCareer(start, { load, focus }, policy);
  return {
    bestRank: state.stats.bestRank, majors: state.stats.majors, titles: state.stats.titles, swingsAtOne: state.stats.swingsAtOne,
    retiredAt: state.user.player.age, swings, potential: pick.potential, peakOvr: state.user.peak,
  };
}

export interface JourneyMetrics {
  top100: number;
  top10: number;
  majorWinner: number;
  no1: number;
  retireAge: number;
  swings: number;
}

export function journeyMetrics(runs: readonly CareerRun[]): JourneyMetrics {
  const share = (f: (r: CareerRun) => boolean) => runs.filter(f).length / runs.length;
  const mean = (f: (r: CareerRun) => number) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
  return {
    top100: share((r) => r.bestRank !== null && r.bestRank <= 100),
    top10: share((r) => r.bestRank !== null && r.bestRank <= 10),
    majorWinner: share((r) => r.majors > 0),
    no1: share((r) => r.bestRank === 1),
    retireAge: mean((r) => r.retiredAt),
    swings: mean((r) => r.swings),
  };
}

/** journey-design.md §8. */
export const JOURNEY_TARGETS: Record<keyof JourneyMetrics, readonly [number, number]> = {
  top100: [0.6, 0.8],
  top10: [0.15, 0.3],
  majorWinner: [0.08, 0.18],
  no1: [0.02, 0.06],
  retireAge: [31, 35],
  swings: [60, 95],
};
