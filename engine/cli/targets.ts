// GDD §10 M1 tuning targets for two average tour players (design goals, not measured facts).
import type { Summary } from '../src/match/metrics.ts';
import type { Surface } from '../src/types.ts';

export interface Target {
  label: string;
  key: keyof Summary;
  min: number;
  max: number;
  percent: boolean;
}

const HOLD: Record<Surface, [number, number]> = { hard: [0.75, 0.85], clay: [0.7, 0.8], grass: [0.8, 0.9] };

export function targetsFor(surface: Surface): Target[] {
  const [holdMin, holdMax] = HOLD[surface];
  return [
    { label: `Service hold % (${surface})`, key: 'holdPct', min: holdMin, max: holdMax, percent: true },
    { label: 'Aces / service game', key: 'acesPerServiceGame', min: 0.3, max: 0.8, percent: false },
    { label: 'Double faults / service game', key: 'doubleFaultsPerServiceGame', min: 0.15, max: 0.35, percent: false },
    { label: '1st serve in %', key: 'firstServeInPct', min: 0.58, max: 0.68, percent: true },
    { label: '1st serve points won %', key: 'firstServePointsWonPct', min: 0.68, max: 0.78, percent: true },
    { label: '2nd serve points won %', key: 'secondServePointsWonPct', min: 0.48, max: 0.56, percent: true },
    { label: 'Average rally length (shots)', key: 'avgRally', min: 3.5, max: 5.5, percent: false },
    { label: 'Rallies of 4 shots or fewer %', key: 'shortRallyPct', min: 0.6, max: 0.75, percent: true },
    { label: 'Sets with a tiebreak %', key: 'tiebreakSetPct', min: 0.1, max: 0.25, percent: true },
  ];
}

/** GDD: a big server makes 1.0+ aces per service game. */
export const BIG_SERVER_ACES: Target = {
  label: 'Big server (A) aces / service game', key: 'acesPerServiceGame', min: 1.0, max: Number.POSITIVE_INFINITY, percent: false,
};
