// The clock of a quick-match stretch (Broadcast.playSpans, ADR-030): match seconds advance with real time × speed,
// across span ends without a break; every speed change ramps in (presentation spec E3).

/** The most real time one frame may count; a longer stall (hidden tab, compile) only freezes the picture. */
export const MAX_FRAME_SEC = 0.25;

/** Match seconds [from, to] at `speed`; `gap` marks the walk back between points (the ▶▶ chip). */
export interface PlaySpan { from: number; to: number; speed: number; gap?: boolean }

/** Where a stretch of spans is: span `i` (spans.length when done), match second `t`, real seconds into span i. */
export interface SpanState { i: number; t: number; since: number }

/** The speed `since` real seconds into span `i`: from the previous span's speed to its own over `rampSec` (E3). */
export function spanSpeed(spans: readonly PlaySpan[], i: number, since: number, rampSec: number): number {
  const own = spans[i]!.speed;
  const before = spans[i - 1]?.speed ?? own;
  return since >= rampSec ? own : before + (own - before) * (since / rampSec);
}

/** The stretch after a frame of `dt` real seconds: the clock runs on across span ends without a break. */
export function spanStep(spans: readonly PlaySpan[], state: SpanState, dt: number, rampSec: number): SpanState {
  let { i, t, since } = state;
  let left = Math.min(dt, MAX_FRAME_SEC);
  while (left > 0 && i < spans.length) {
    const speed = spanSpeed(spans, i, since, rampSec);
    const to = spans[i]!.to;
    if (t + left * speed < to) return { i, t: t + left * speed, since: since + left };
    left -= (to - t) / speed;
    i++;
    t = spans[i]?.from ?? to;
    since = 0;
  }
  return { i, t, since };
}
