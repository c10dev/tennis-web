// Plays a quick match's points on the broadcast in the hybrid edit (ADR-030): spans in point time (game spans.ts)
// become match seconds on the loaded timeline, played as one stretch with ramped speeds.
import type { PointEvent } from '@tennis/engine';
import { pointSpans, QUICK_PACE, trailingGap, type Shown, type Span } from '@tennis/game';
import type { Timeline } from '@tennis/renderer';
import type { Broadcast } from '../replay/broadcast.ts';

export interface PointPlayer {
  /** Plays a point as `shown` says: from its serve, after its walk back when it follows on from the point before. */
  play(point: PointEvent, shown: Shown): Promise<void>;
  /** The walk after this point to where the next starts, into the decision hold. */
  walkOn(point: PointEvent): Promise<void>;
  /** Behind a wipe: the clock moves to this point's serve (one frame drawn there). */
  seekTo(point: PointEvent): Promise<void>;
}

export function pointPlayer(broadcast: Broadcast, timeline: () => Timeline): PointPlayer {
  const segOf = (point: PointEvent) => timeline().segments.findIndex((x) => x.point.index === point.index);
  const spans = (point: PointEvent, given: Span[]) => {
    const zero = timeline().segments[segOf(point)]!.zero;
    return broadcast.playSpans(given.map((s) => ({ ...s, from: zero + s.from, to: zero + s.to })), QUICK_PACE.hybrid.rampSec);
  };
  return {
    play(point, shown) {
      const i = segOf(point);
      const segs = timeline().segments;
      const before = segs[i - 1];
      return spans(point, pointSpans(point, shown, before ? segs[i]!.start - before.end : 0));
    },
    walkOn(point) {
      // The timeline's own pause after the point: a changeover's is longer.
      const seg = timeline().segments[segOf(point)]!;
      return spans(point, [trailingGap(point, seg.next - seg.end)]);
    },
    seekTo(point) {
      const seg = timeline().segments[segOf(point)]!;
      return broadcast.playWindow(seg.start, seg.start, 1);
    },
  };
}
