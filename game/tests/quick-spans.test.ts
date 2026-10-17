import { describe, expect, it } from 'vitest';
import type { PointEvent } from '@tennis/engine';
import { batchPlan, DECISION_SHOWN, hybridSeconds, pointSpans, spanSeconds, trailingGap, type Span } from '../src/quick/spans.ts';
import { QUICK_PACE } from '../src/tuning.ts';
import { freshLadder, playLadderMatch } from './quick-helpers.ts';

// The hybrid edit (presentation spec E8 C): the opening points as units behind wipes, then from the point before the
// first decision one continuous picture: the walk back at 5×, points at up to 2× landing at 1×, the crunch at 1×.
const H = QUICK_PACE.hybrid;
const matches = [1, 2, 3].map((seed) => playLadderMatch(freshLadder(seed)).m.live.events.filter((e): e is PointEvent => e.type === 'point'));
const points = matches.flat();
const lastContact = (p: PointEvent) => p.shots.at(-1)!.t;

function contiguous(spans: Span[]) {
  for (let i = 1; i < spans.length; i++) expect(spans[i]!.from).toBeCloseTo(spans[i - 1]!.to, 9);
  for (const s of spans) expect(s.to).toBeGreaterThan(s.from);
}

describe('batchPlan', () => {
  it('shows the opening points as units behind wipes, the one before the first decision live', () => {
    expect(batchPlan(4, false, true)).toEqual([
      { live: false, wipe: false, gap: false },
      { live: false, wipe: true, gap: false },
      { live: false, wipe: true, gap: false },
      { live: true, wipe: true, gap: false },
    ]);
  });

  it('plays every point after the first decision on from the last, walk back included, the one before a stop live', () => {
    expect(batchPlan(3, true, true)).toEqual([
      { live: false, wipe: false, gap: true },
      { live: false, wipe: false, gap: true },
      { live: true, wipe: false, gap: true },
    ]);
  });

  it('runs the points to the end of a match that ends without a stop', () => {
    expect(batchPlan(2, true, false).every((s) => !s.live && s.gap && !s.wipe)).toBe(true);
    expect(batchPlan(2, false, false)).toEqual([{ live: false, wipe: false, gap: false }, { live: false, wipe: true, gap: false }]);
    expect(batchPlan(0, true, true)).toEqual([]);
  });

  it('plays a decision point live after the hold, its walk-in already shown', () => {
    expect(DECISION_SHOWN).toEqual({ live: true, wipe: false, gap: false });
  });
});

describe('pointSpans', () => {
  it('opens every point on its serve and plays it to its end without a break', () => {
    for (const p of points) {
      for (const shown of [{ live: false, wipe: true, gap: false }, { live: true, wipe: false, gap: false }]) {
        const spans = pointSpans(p, shown, 2.5);
        contiguous(spans);
        expect(spans[0]!.from).toBeCloseTo(-QUICK_PACE.tossSec, 9);
        expect(spans.at(-1)!.to).toBeCloseTo(p.durationSec, 9);
      }
    }
  });

  it('plays the walk back before a point at the gap speed, marked as a gap', () => {
    const p = points[0]!;
    const spans = pointSpans(p, { live: false, wipe: false, gap: true }, 2.5);
    expect(spans[0]).toEqual({ from: -QUICK_PACE.tossSec - 2.5, to: -QUICK_PACE.tossSec, speed: H.gapSpeed, gap: true });
    expect(spans.slice(1).every((s) => !s.gap)).toBe(true);
    contiguous(spans);
  });

  it('speeds a point without cards up to the last contact and lands its ending at 1×', () => {
    for (const p of points) {
      const spans = pointSpans(p, { live: false, wipe: false, gap: false }, 2.5);
      const slowFrom = Math.max(-QUICK_PACE.tossSec, lastContact(p) - H.leadSec);
      expect(spans.at(-1)).toMatchObject({ from: slowFrom, speed: 1 });
      if (slowFrom > -QUICK_PACE.tossSec) expect(spans[0]).toMatchObject({ from: -QUICK_PACE.tossSec, to: slowFrom, speed: H.fastSpeed });
      else expect(spans).toHaveLength(1);
    }
  });

  it('plays a live point at 1×, the start of a long one sped up', () => {
    expect(points.some((p) => p.durationSec + QUICK_PACE.tossSec > QUICK_PACE.keyMaxSec)).toBe(true);
    for (const p of points) {
      const spans = pointSpans(p, { live: true, wipe: false, gap: false }, 2.5);
      const slowFrom = Math.max(-QUICK_PACE.tossSec, p.durationSec - QUICK_PACE.keyMaxSec);
      expect(spans.at(-1)).toMatchObject({ from: slowFrom, speed: 1 });
      expect(spans).toHaveLength(slowFrom > -QUICK_PACE.tossSec ? 2 : 1);
    }
  });

  it('walks to the next start after the last point before a stop', () => {
    const p = points[0]!;
    expect(trailingGap(p, 2.5)).toEqual({ from: p.durationSec, to: p.durationSec + 2.5, speed: H.gapSpeed, gap: true });
  });
});

describe('hybridSeconds', () => {
  it('adds the spans, the wipes and the reveals, batch by batch', () => {
    for (const pts of matches) {
      let sum = 0;
      let decided = false;
      for (let i = 0; i < pts.length;) {
        if (pts[i]!.cards) {
          sum += spanSeconds(pointSpans(pts[i]!, DECISION_SHOWN, H.gapSec)) + QUICK_PACE.revealSec;
          // Two stops in a row: the walk after the first plays into the second's hold.
          if (pts[i + 1]?.cards) sum += spanSeconds([trailingGap(pts[i]!, H.gapSec)]);
          decided = true;
          i++;
          continue;
        }
        let j = i;
        while (j < pts.length && !pts[j]!.cards) j++;
        const stops = j < pts.length;
        batchPlan(j - i, decided, stops).forEach((s, k) => {
          sum += spanSeconds(pointSpans(pts[i + k]!, s, H.gapSec)) + (s.wipe ? H.wipeSec : 0);
        });
        if (stops) sum += spanSeconds([trailingGap(pts[j - 1]!, H.gapSec)]);
        i = j;
      }
      expect(hybridSeconds(pts)).toBeCloseTo(sum, 9);
    }
  });

  it('counts a span at its speed', () => {
    expect(spanSeconds([{ from: 0, to: 4, speed: 2 }, { from: 4, to: 5, speed: 1 }])).toBeCloseTo(3, 9);
  });
});
