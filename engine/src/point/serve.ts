// Serve odds (GDD §5.2): in %, aces and the quality of a serve that lands in.
import { type PlayerRuntime } from '../player/condition.ts';
import { chance, weightedIndex, type Rng } from '../rng/mulberry32.ts';
import { AVG, SERVE, SURFACES } from '../tuning.ts';
import type { Surface, Tactic } from '../types.ts';
import { clamp01, shifted } from './prob.ts';

export type ServeTarget = 'wide' | 'body' | 't';

export interface ServeOdds {
  pIn: number;
  /** Chance that a serve which lands in is an ace. */
  pAce: number;
  /** Mean difficulty of the serve for the returner, 0–1. */
  quality: number;
}

export function serveOdds(
  server: PlayerRuntime, returner: PlayerRuntime, serveNumber: 1 | 2, target: ServeTarget, surface: Surface, pressure: number,
): ServeOdds {
  const s = server.n;
  const t = SERVE.targets[target];
  const acc = s.serveAccuracy - AVG + server.affinity;
  const pow = s.servePower - AVG + server.affinity;
  const ret = returner.n.return - AVG + returner.affinity;
  const nerves = SERVE.pressureIn * pressure * (1 - s.composure);
  const pIn = serveNumber === 1
    ? shifted(SERVE.firstIn, SERVE.firstInAccuracy * acc + SERVE.firstInPower * pow + t.in + nerves)
    : shifted(SERVE.secondIn, SERVE.secondInSkill * (s.secondServe - AVG + server.affinity) + t.in / 2 + nerves);
  const aceBase = (serveNumber === 1 ? SERVE.aceFirst : SERVE.aceSecond) * SURFACES[surface].ace;
  const pAce = shifted(aceBase, SERVE.acePower * pow + SERVE.aceAccuracy * acc + SERVE.aceReturn * ret + t.ace);
  const base = serveNumber === 1 ? SERVE.qualityFirst : SERVE.qualitySecond;
  const quality = clamp01(base + SERVE.qualityPower * pow + SERVE.qualityAccuracy * acc + SURFACES[surface].serveQuality + t.quality);
  return { pIn, pAce, quality };
}

const MIX: readonly ServeTarget[] = ['wide', 'body', 't'];
const MIX_WEIGHTS = [0.4, 0.2, 0.4];

export function chooseServeTarget(rng: Rng, tactic: Tactic): ServeTarget {
  return tactic.serveTarget === 'mix' ? MIX[weightedIndex(rng, MIX_WEIGHTS)]! : tactic.serveTarget;
}

/** Draws one serve: 'fault', 'ace' or 'in' with the returner's incoming quality. */
export function drawServe(rng: Rng, odds: ServeOdds): { kind: 'fault' } | { kind: 'ace' } | { kind: 'in'; quality: number } {
  if (!chance(rng, odds.pIn)) return { kind: 'fault' };
  if (chance(rng, odds.pAce)) return { kind: 'ace' };
  return { kind: 'in', quality: clamp01(odds.quality + SERVE.qualitySpread * (2 * rng.next() - 1)) };
}
