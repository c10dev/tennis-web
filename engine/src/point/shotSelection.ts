// Shot selection (GDD §5.1 step 2): risk level and target side, sampled from weights.
import type { PlayerRuntime } from '../player/condition.ts';
import { weightedIndex, type Rng } from '../rng/mulberry32.ts';
import { SELECTION, type Risk } from '../tuning.ts';

export type TargetSide = 'forehand' | 'backhand' | 'middle';

export interface ShotChoice {
  risk: Risk;
  target: TargetSide;
}

const RISKS: readonly Risk[] = ['safe', 'neutral', 'aggressive'];
const TARGETS: readonly TargetSide[] = ['forehand', 'backhand', 'middle'];

export function riskWeights(p: PlayerRuntime, incoming: number): Record<Risk, number> {
  const appetite = SELECTION.tacticWeight * p.tactic.aggression + (1 - SELECTION.tacticWeight) * p.n.aggression;
  // Good decision-makers defend against a hard ball and attack a weak one.
  const read = Math.exp(SELECTION.decisionRead * p.n.decision * (incoming - 0.5));
  return {
    safe: SELECTION.safeBase * (1 - appetite) * read + 0.05,
    neutral: 1,
    aggressive: (SELECTION.aggressiveBase * appetite) / read + 0.02,
  };
}

export function targetWeights(hitter: PlayerRuntime, opponent: PlayerRuntime): Record<TargetSide, number> {
  const backhandGap = opponent.n.forehand - opponent.n.backhand;
  let backhand = Math.exp(SELECTION.decisionWing * hitter.n.decision * backhandGap);
  if (hitter.tactic.targetBackhand) backhand *= SELECTION.targetBackhand;
  return { forehand: 1, backhand, middle: SELECTION.middle };
}

export function chooseShot(rng: Rng, hitter: PlayerRuntime, opponent: PlayerRuntime, incoming: number): ShotChoice {
  const r = riskWeights(hitter, incoming);
  const t = targetWeights(hitter, opponent);
  const risk = RISKS[weightedIndex(rng, [r.safe, r.neutral, r.aggressive])]!;
  const target = TARGETS[weightedIndex(rng, [t.forehand, t.backhand, t.middle])]!;
  return { risk, target };
}
