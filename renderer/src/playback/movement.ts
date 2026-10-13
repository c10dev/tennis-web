// Where each player stands at replay time t: moved between the positions the shot events record.
import type { PlayerId, PointEvent, Vec2 } from '@tennis/engine';
import { lerp, trapezoid } from '../math.ts';
import { COURT_DRAW, PLAYBACK, RIG_MOTION } from '../tuning/index.ts';
import { segmentAt, type Timeline } from './timeline.ts';

interface Key { tau: number; pos: Vec2 }

const ease = (a: Vec2, b: Vec2, u: number): Vec2 => {
  const k = trapezoid(u, RIG_MOTION.easeRamp);
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
};
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

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

/** Walk along a polyline at eased speed over the whole path, u from 0 to 1. */
function along(path: Vec2[], u: number): Vec2 {
  const lengths = path.slice(1).map((p, i) => dist(path[i]!, p));
  let left = trapezoid(u, RIG_MOTION.easeRamp) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]! || i === lengths.length - 1) {
      const k = lengths[i]! > 0 ? Math.min(1, left / lengths[i]!) : 1;
      return { x: lerp(path[i]!.x, path[i + 1]!.x, k), y: lerp(path[i]!.y, path[i + 1]!.y, k) };
    }
    left -= lengths[i]!;
  }
  return path.at(-1)!;
}

/** Changing ends: round the net post on the umpire's side, each player in their own lane. */
function changeEnds(id: PlayerId, from: Vec2, to: Vec2): Vec2[] {
  const lane = id === 'A' ? 0 : 1;
  const x = -(COURT_DRAW.doublesHalfWidth + COURT_DRAW.postOutside + RIG_MOTION.changeEndsLaneOffset + lane * RIG_MOTION.changeEndsLaneGap);
  return [from, { x, y: Math.sign(from.y) }, { x, y: Math.sign(to.y) }, to];
}

/** During a point, positions move between keyframes; in the pause after it, players walk to the next point's start. */
export function positionAt(timeline: Timeline, id: PlayerId, t: number): Vec2 {
  const i = segmentAt(timeline, t);
  const seg = timeline.segments[i]!;
  if (t < seg.end) return within(seg.point, id, t - seg.zero);
  const last = within(seg.point, id, seg.end - seg.zero);
  const next = timeline.segments[i + 1];
  if (!next) return last;
  const start = keys(next.point, id)[0]!.pos;
  const u = (t - seg.end) / (seg.next - seg.end);
  if (Math.sign(start.y) !== Math.sign(last.y)) return along(changeEnds(id, last, start), u);
  return ease(last, start, u);
}
