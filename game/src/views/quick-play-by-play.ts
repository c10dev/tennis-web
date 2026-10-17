// The decisive point as text (ADR-017): the fast-mode replay on the result screen, one line at a time.
import type { PointEvent, ShotEvent } from '@tennis/engine';
import type { Highlight } from '../quick/highlight.ts';
import { en } from '../text/en.ts';
import type { Ending, Messages } from '../text/types.ts';

const stroke = (s: ShotEvent, t: Messages) => t.pbp.stroke(s.shot, s.wing ?? 'forehand');

/** How the point ended, said from the user's side: "Their forehand winner". */
export function ending(p: PointEvent, t: Messages): string {
  const last = p.shots.at(-1);
  if (p.endedBy === 'ace') return t.pbp.ending('ace', p.server === 'A', '');
  if (p.endedBy === 'double_fault' || !last) return t.pbp.ending('double_fault', p.server === 'A', '');
  const kind: Ending = p.endedBy === 'winner' ? 'winner' : p.endedBy === 'forced_error' ? 'forced_error' : 'error';
  return t.pbp.ending(kind, last.hitter === 'A', stroke(last, t));
}

export function playByPlay(p: PointEvent, h: Highlight, t: Messages = en): string[] {
  const serve = p.shots.find((s) => s.shot === 'serve' && s.outcome !== 'fault') ?? p.shots[0];
  const [a, b] = p.scoreAfter.points;
  return [
    t.pbp.opening(h.score, p.server === 'A'),
    h.user && h.ai ? t.pbp.cards(h.user, h.ai) : t.pbp.noCards,
    serve ? t.pbp.serve(p.serveNumber === 1, Math.round(serve.speedKmh)) : null,
    p.rallyLength > 2 ? t.pbp.rally(p.rallyLength) : null,
    ending(p, t),
    t.pbp.close(p.winner === 'A', p.scoreAfter.sets.length > p.scoreBefore.sets.length, `${a}-${b}`),
  ].filter((x): x is string => x !== null);
}
