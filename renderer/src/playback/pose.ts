// A player's pose at replay time t, from the events alone: what a rig needs to draw them (ADR-007).
import type { PlayerId, Vec2, Vec3 } from '@tennis/engine';
import { RIG_MOTION } from '../tuning.ts';
import { positionAt } from './movement.ts';
import { segmentAt, type Timeline } from './timeline.ts';

export type SwingKind = 'serve' | 'forehand' | 'backhand';
export type Reaction = 'none' | 'celebrate' | 'dejected';

export interface PlayerPose {
  pos: Vec2;
  /** Unit vector in court coordinates the player faces. */
  facing: Vec2;
  /** Running speed in m/s. */
  speed: number;
  /** Swing in progress: phase 0 → 1, contact at 0.5. */
  swing: { kind: SwingKind; phase: number } | null;
  reaction: Reaction;
}

export function playerPose(timeline: Timeline, id: PlayerId, t: number, ball: Vec3 | null): PlayerPose {
  const pos = positionAt(timeline, id, t);
  const dt = RIG_MOTION.speedSampleSec;
  const before = positionAt(timeline, id, Math.max(0, t - dt));
  const after = positionAt(timeline, id, Math.min(timeline.totalSec, t + dt));
  const sameSide = Math.sign(before.y) === Math.sign(after.y);
  const speed = sameSide ? Math.hypot(after.x - before.x, after.y - before.y) / (2 * dt) : 0;
  return { pos, facing: facing(pos, ball), speed, swing: swing(timeline, id, t), reaction: reaction(timeline, id, t) };
}

function facing(pos: Vec2, ball: Vec3 | null): Vec2 {
  if (ball) {
    const d = Math.hypot(ball.x - pos.x, ball.y - pos.y);
    if (d > 0.5) return { x: (ball.x - pos.x) / d, y: (ball.y - pos.y) / d };
  }
  return { x: 0, y: -Math.sign(pos.y) };
}

function swing(timeline: Timeline, id: PlayerId, t: number): PlayerPose['swing'] {
  const seg = timeline.segments[segmentAt(timeline, t)]!;
  const tau = t - seg.zero;
  for (const s of seg.point.shots) {
    if (s.hitter !== id) continue;
    const kind: SwingKind = s.shot === 'serve' ? 'serve' : (s.wing ?? 'forehand');
    const { pre, post } = s.shot === 'serve' ? RIG_MOTION.swing.serve : RIG_MOTION.swing.stroke;
    if (tau < s.t - pre || tau > s.t + post) continue;
    const phase = tau < s.t ? 0.5 * (tau - (s.t - pre)) / pre : 0.5 + 0.5 * (tau - s.t) / post;
    return { kind, phase };
  }
  return null;
}

function reaction(timeline: Timeline, id: PlayerId, t: number): Reaction {
  const seg = timeline.segments[segmentAt(timeline, t)]!;
  const last = seg.point.shots.at(-1)!;
  const landed = seg.zero + last.t + last.flightSec;
  if (t < landed || t >= Math.min(landed + RIG_MOTION.reactionSec, seg.next)) return 'none';
  return seg.point.winner === id ? 'celebrate' : 'dejected';
}
