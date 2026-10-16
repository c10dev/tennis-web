// Which way a player faces (TD-057): towards the ball while it is in play and the net otherwise, every change eased so
// the body never turns round in one frame. Like every pose, a closed-form function of replay time (ADR-007).
import type { PlayerId, Vec2, Vec3 } from '@tennis/engine';
import { smoothstep } from '../math.ts';
import { RIG_MOTION } from '../tuning/index.ts';
import { ballAt, ballSpans } from './ball.ts';
import { positionAt } from './movement.ts';
import type { PointSegment, Timeline } from './timeline.ts';

const F = RIG_MOTION.facing;
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/** Angle (as atan2) of the direction from a player's end towards the net. */
const netAngle = (pos: Vec2): number => (pos.y < 0 ? Math.PI / 2 : -Math.PI / 2);

/**
 * How far from the net direction (radians) a player at `pos` turns to follow `ball`: fully once it is `nearFull` away
 * and in front, not at all within `nearMin`, and less the further behind them it is, so they look over the shoulder
 * instead of spinning round as a ball passes.
 */
function follow(pos: Vec2, ball: Vec3 | null): number {
  if (!ball) return 0;
  const dx = ball.x - pos.x;
  const dy = ball.y - pos.y;
  const near = smoothstep((Math.hypot(dx, dy) - F.nearMin) / (F.nearFull - F.nearMin));
  const off = wrap(Math.atan2(dy, dx) - netAngle(pos));
  return off * near * smoothstep((Math.PI - Math.abs(off)) / (Math.PI / 2));
}

/**
 * The turn towards the ball at point time `tau`: it eases in over `settleSec` when the ball appears and out over the
 * same when it goes; a new stretch of play (a second serve's toss) eases in from whatever is left of the last one.
 */
function ballTurn(timeline: Timeline, id: PlayerId, seg: PointSegment, tau: number): number {
  const look = (at: number) => follow(positionAt(timeline, id, seg.zero + at), ballAt(seg.point, at, timeline.surface));
  const fade = (v: number, dt: number) => v * (1 - smoothstep(dt / F.settleSec));
  let carry = 0;
  let since = -Infinity;
  for (const span of ballSpans(seg.point)) {
    if (tau < span.from) break;
    const turn = (at: number, ball: number) => {
      const left = fade(carry, at - since);
      return left + (ball - left) * smoothstep((at - span.from) / F.settleSec);
    };
    if (tau <= span.to) return turn(tau, look(tau));
    // The ball just before the stretch ends: at its end the next serve's toss may already own the ball.
    carry = turn(span.to, look(span.to - 1e-9));
    since = span.to;
  }
  return fade(carry, tau - since);
}

/** Changing ends, a player faces their walk: velocity smoothed over ± `walkWindowSec`, eased in and out. */
function walkTurn(timeline: Timeline, id: PlayerId, index: number, t: number): { angle: number; weight: number } | null {
  const seg = timeline.segments[index]!;
  const next = timeline.segments[index + 1];
  if (!next || t < seg.end) return null;
  if (Math.sign(positionAt(timeline, id, seg.end).y) === Math.sign(positionAt(timeline, id, seg.next).y)) return null;
  const a = positionAt(timeline, id, Math.max(seg.end, t - F.walkWindowSec));
  const b = positionAt(timeline, id, Math.min(seg.next - 1e-9, t + F.walkWindowSec));
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) return null;
  const u = (t - seg.end) / (seg.next - seg.end);
  return { angle: Math.atan2(b.y - a.y, b.x - a.x), weight: smoothstep(Math.min(u, 1 - u) / F.walkTurnShare) };
}

/** Unit vector in court coordinates a player faces at replay time t (before any turn into their own shot). */
export function facingAt(timeline: Timeline, id: PlayerId, index: number, t: number, pos: Vec2): Vec2 {
  const seg = timeline.segments[index]!;
  let angle = netAngle(pos) + ballTurn(timeline, id, seg, t - seg.zero);
  const walk = walkTurn(timeline, id, index, t);
  if (walk) angle += walk.weight * wrap(walk.angle - angle);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
