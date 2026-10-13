// The decisive point as text (ADR-017): the fast-mode replay on the result screen, one line at a time.
import type { PlayerId, PointEvent, ShotEvent } from '@tennis/engine';
import type { Highlight } from '../quick/highlight.ts';

const who = (p: PlayerId) => (p === 'A' ? 'Your' : 'Their');

function stroke(s: ShotEvent): string {
  const wing = s.wing ?? 'forehand';
  if (s.shot === 'drive' || s.shot === 'return' || s.shot === 'approach') return wing;
  if (s.shot === 'slice') return `${wing} slice`;
  return s.shot;
}

function ending(p: PointEvent): string {
  const last = p.shots.at(-1);
  if (p.endedBy === 'ace') return `${who(p.server)} ace`;
  if (p.endedBy === 'double_fault' || !last) return `${who(p.server)} double fault`;
  if (p.endedBy === 'winner') return `${who(last.hitter)} ${stroke(last)} winner`;
  return `${who(last.hitter)} ${stroke(last)} ${p.endedBy === 'forced_error' ? 'forced into an error' : 'error'}`;
}

export function playByPlay(p: PointEvent, h: Highlight): string[] {
  const serve = p.shots.find((s) => s.shot === 'serve' && s.outcome !== 'fault') ?? p.shots[0];
  const [a, b] = p.scoreAfter.points;
  return [
    `${h.score} · ${p.server === 'A' ? 'You serve' : 'They serve'}`,
    h.user && h.ai ? `You ${h.user}, they ${h.ai}` : 'No cards: your game plan',
    serve ? `${p.serveNumber === 1 ? 'First' : 'Second'} serve, ${Math.round(serve.speedKmh)} km/h` : null,
    p.rallyLength > 2 ? `${p.rallyLength}-shot rally` : null,
    `${ending(p)}`,
    `${p.winner === 'A' ? 'Your point' : 'Their point'}${p.scoreAfter.sets.length > p.scoreBefore.sets.length ? ' · game, set and match' : ` · ${a}-${b}`}`,
  ].filter((x): x is string => x !== null);
}
