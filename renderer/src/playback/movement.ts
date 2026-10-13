// Where each player stands at replay time t: eased between the positions the shot events record.
import type { PlayerId, PointEvent, Vec2 } from '@tennis/engine';
import { lerp, smoothstep } from '../math.ts';
import { PLAYBACK } from '../tuning.ts';
import { segmentAt, type Timeline } from './timeline.ts';

interface Key { tau: number; pos: Vec2 }

const ease = (a: Vec2, b: Vec2, u: number): Vec2 => {
  const k = smoothstep(u);
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
};

/** Point-time keyframes for one player: the serve's starting spot, then their position at every shot. */
function keys(point: PointEvent, id: PlayerId): Key[] {
  const at = (s: PointEvent['shots'][number]) => (s.hitter === id ? s.hitterPos : s.receiverPos);
  const first = point.shots[0]!;
  return [{ tau: -PLAYBACK.tossLeadSec, pos: at(first) }, ...point.shots.map((s) => ({ tau: s.t, pos: at(s) }))];
}

function within(point: PointEvent, id: PlayerId, tau: number): Vec2 {
  const k = keys(point, id);
  for (let i = k.length - 1; i > 0; i--) {
    const a = k[i - 1]!;
    const b = k[i]!;
    if (tau >= b.tau) return b.pos;
    if (tau >= a.tau && b.tau > a.tau) return ease(a.pos, b.pos, (tau - a.tau) / (b.tau - a.tau));
  }
  return k[0]!.pos;
}

/**
 * During a point, positions are eased between keyframes. In the pause after it, players walk to where the next point
 * starts; when they change ends they hold, then cut across at the middle of the pause (TD-010).
 */
export function positionAt(timeline: Timeline, id: PlayerId, t: number): Vec2 {
  const i = segmentAt(timeline, t);
  const seg = timeline.segments[i]!;
  if (t < seg.end) return within(seg.point, id, t - seg.zero);
  const last = within(seg.point, id, seg.end - seg.zero);
  const next = timeline.segments[i + 1];
  if (!next) return last;
  const start = keys(next.point, id)[0]!.pos;
  const u = (t - seg.end) / (seg.next - seg.end);
  if (Math.sign(start.y) !== Math.sign(last.y)) return u < 0.5 ? last : start;
  return ease(last, start, u);
}
