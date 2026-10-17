// The hybrid edit (ADR-030, presentation spec E8 C): the opening points play as units behind wipes; from the point
// before the first decision on, the match is one continuous picture: each walk back at the gap speed, points without
// cards sped up and landing at 1×, the point before a stop and the decision point at 1×. Spans are in point time
// (τ = 0 at the first serve's contact), so the UI adds the point's segment zero; the seconds model sums them.
import type { PointEvent } from '@tennis/engine';
import { QUICK_PACE } from '../tuning.ts';

/** Point seconds [from, to] played at `speed`; `gap` marks the walk back (the UI shows its ▶▶ chip). */
export interface Span { from: number; to: number; speed: number; gap?: boolean }

/** How a point is shown: `live` at 1× (sped only where a long one runs past keyMaxSec), else sped to its last contact;
 *  `wipe` behind a wipe from the point before; `gap` after its walk back from the point before. */
export interface Shown { live: boolean; wipe: boolean; gap: boolean }

const H = QUICK_PACE.hybrid;

/** A decision point plays live after the hold; the walk to its start played before the hold. */
export const DECISION_SHOWN: Shown = { live: true, wipe: false, gap: false };

/**
 * The points a quick match plays before its next stop (`stops`) or its end. Before the first decision (`decided`
 * false) they are units, each after a wipe but the match's first; the one before the stop plays live. After it,
 * every point follows on from the last, the one before a stop live.
 */
export function batchPlan(count: number, decided: boolean, stops: boolean): Shown[] {
  return Array.from({ length: count }, (_, i) => ({ live: stops && i === count - 1, wipe: !decided && i > 0, gap: decided }));
}

/** The spans of one point: its walk back when `shown.gap` (the gap before it lasts `gapSec`), then toss to end. */
export function pointSpans(p: PointEvent, shown: Shown, gapSec: number): Span[] {
  const toss = -QUICK_PACE.tossSec;
  const slowFrom = Math.max(toss, shown.live ? p.durationSec - QUICK_PACE.keyMaxSec : p.shots.at(-1)!.t - H.leadSec);
  const spans: Span[] = [];
  if (shown.gap && gapSec > 0) spans.push({ from: toss - gapSec, to: toss, speed: H.gapSpeed, gap: true });
  if (slowFrom > toss) spans.push({ from: toss, to: slowFrom, speed: H.fastSpeed });
  spans.push({ from: slowFrom, to: p.durationSec, speed: 1 });
  return spans;
}

/** The walk after the last point before a stop, into the decision hold. */
export const trailingGap = (p: PointEvent, gapSec: number): Span => ({ from: p.durationSec, to: p.durationSec + gapSec, speed: H.gapSpeed, gap: true });

/** Screen seconds of these spans (the ramps aside: about 0.1 s each). */
export const spanSeconds = (spans: readonly Span[]): number => spans.reduce((sum, s) => sum + (s.to - s.from) / s.speed, 0);

/** Seconds on screen for a quick match's points in the hybrid edit, thinking time aside. */
export function hybridSeconds(points: readonly PointEvent[], gapSec: number = H.gapSec): number {
  let sum = 0;
  let decided = false;
  for (let i = 0; i < points.length;) {
    const p = points[i]!;
    if (p.cards) {
      sum += spanSeconds(pointSpans(p, DECISION_SHOWN, gapSec)) + QUICK_PACE.revealSec;
      if (points[i + 1]?.cards) sum += spanSeconds([trailingGap(p, gapSec)]);
      decided = true;
      i++;
      continue;
    }
    let j = i;
    while (j < points.length && !points[j]!.cards) j++;
    const stops = j < points.length;
    batchPlan(j - i, decided, stops).forEach((s, k) => {
      sum += spanSeconds(pointSpans(points[i + k]!, s, gapSec)) + (s.wipe ? H.wipeSec : 0);
    });
    if (stops) sum += spanSeconds([trailingGap(points[j - 1]!, gapSec)]);
    i = j;
  }
  return sum;
}
