// Viewing modes (GDD §8.5): which points a programme shows.
import type { PointTag } from '@tennis/engine';
import type { Timeline, PointSegment } from '../playback/timeline.ts';
import { BROADCAST } from '../tuning/index.ts';
import type { ViewMode } from './types.ts';

/** Points that can decide a game, set or match. */
export const BIG_POINTS: ReadonlySet<PointTag> = new Set(['break_point', 'set_point', 'match_point']);

/** Break, set and match points, tiebreak points, and every point that ends a game. */
export const isKeyPoint = (s: PointSegment): boolean => s.endsGame || s.point.tags.some((t) => BIG_POINTS.has(t) || t === 'tiebreak');

export function selectPoints(timeline: Timeline, mode: ViewMode): number[] {
  const all = timeline.segments.map((_, i) => i);
  if (mode === 'full') return all;
  if (mode === 'result') return [];
  if (mode === 'key') return all.filter((i) => isKeyPoint(timeline.segments[i]!));
  const picked = new Set<number>();
  let gameStart = 0;
  timeline.segments.forEach((s, i) => {
    const p = s.point;
    const rally = p.rallyLength >= BROADCAST.longRally || (p.endedBy === 'winner' && p.rallyLength >= BROADCAST.winnerRally);
    if (isKeyPoint(s) || rally) picked.add(i);
    if (!s.endsGame) return;
    if (s.isBreak) for (let k = gameStart; k <= i; k++) picked.add(k);
    gameStart = i + 1;
  });
  return [...picked].sort((a, b) => a - b);
}
