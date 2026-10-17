// The quick match's context captions (presentation spec E5, TD-075): a lower-third before a point that matters and a
// one-line result after it (game quick-captions.ts), on the stage's lower edge under the near baseline (L3). Driven
// by the broadcast's frames in match time, so the hybrid edit never waits for a caption (ADR-030); once up, a caption
// stays QUICK_PACE.caption.minSec of screen time unless the next one replaces it.
import type { PointEvent } from '@tennis/engine';
import { pointCaptions, QUICK_PACE } from '@tennis/game';
import type { Timeline } from '@tennis/renderer';
import { T } from '../i18n/index.ts';
import { h } from '../lib/h.ts';

type Captions = readonly { before: string | null; after: string | null }[];
type Segment = { start: number; zero: number; end: number; next: number };
export interface Caption { key: string; kind: 'before' | 'after'; text: string }
export type Shown = Caption & { since: number };

/** The caption match second `t` asks for: the lower-third from a point's toss until `serveHoldSec` after its serve,
 *  the result line from its end until the next point's toss. */
export function captionAt(segments: readonly Segment[], captions: Captions, t: number): Caption | null {
  const i = segments.findLastIndex((s) => s.start <= t);
  const seg = segments[i];
  const c = captions[i];
  if (!seg || !c) return null;
  if (c.before && t <= seg.zero + QUICK_PACE.caption.serveHoldSec) return { key: `before:${i}`, kind: 'before', text: c.before };
  if (c.after && t >= seg.end) return { key: `after:${i}`, kind: 'after', text: c.after };
  return null;
}

/** What stays on screen at screen second `now`: a new caption at once, the same one unchanged, none after minSec. */
export function captionShown(up: Shown | null, wanted: Caption | null, now: number): Shown | null {
  if (wanted && wanted.key === up?.key) return up;
  if (wanted) return { ...wanted, since: now };
  return up && now - up.since < QUICK_PACE.caption.minSec ? up : null;
}

export interface CaptionView {
  readonly element: HTMLElement;
  /** Every drawn frame: the caption for this match second (none while a wipe is up; no new one while `live` is off). */
  frame(timeline: Timeline, matchT: number): void;
  /** Off at a decision stop and its reveal (the panel's banner says why: the last result line just runs out its
   *  minSec), on while points play. */
  live(on: boolean): void;
}

export function createCaption(): CaptionView {
  const text = h('span', { class: 'text' });
  const element = h('div', { class: 'quick-caption', id: 'quick-caption', role: 'status', 'aria-live': 'polite' }, text);
  let cached: { timeline: Timeline; captions: Captions } | null = null;
  let up: Shown | null = null;
  let on = true;
  const draw = (next: Shown | null) => {
    if (next === up) return;
    up = next;
    if (next) {
      text.textContent = next.text;
      element.dataset.kind = next.kind;
    }
    element.classList.toggle('is-on', !!next);
  };
  return {
    element,
    frame(timeline, matchT) {
      if (cached?.timeline !== timeline) {
        const points: PointEvent[] = timeline.segments.map((s) => s.point);
        cached = { timeline, captions: pointCaptions(points, T) };
      }
      // Under a wipe the band carries the score, and the point behind it is a new one.
      if (document.body.dataset.wipe === '1') return draw(null);
      draw(captionShown(up, on ? captionAt(timeline.segments, cached.captions, matchT) : null, performance.now() / 1000));
    },
    live(next) {
      on = next;
    },
  };
}
