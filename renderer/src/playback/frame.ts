// Everything drawn at replay time t, as plain data: the renderer's single source of truth (ADR-007).
import type { PlayerId, Vec3 } from '@tennis/engine';
import { scoreBugModel, type ScoreBugModel } from '../overlay/scoreBug.ts';
import { ballAt } from './ball.ts';
import { playerPose, type PlayerPose } from './pose.ts';
import { scoreAt, segmentAt, type Timeline } from './timeline.ts';

export interface Frame {
  /** Replay time, clamped to the match. */
  t: number;
  pointIndex: number;
  /** Ball centre in court coordinates; null when no ball is in play. */
  ball: Vec3 | null;
  players: Record<PlayerId, PlayerPose>;
  scoreBug: ScoreBugModel;
}

export function frameAt(timeline: Timeline, time: number): Frame {
  const t = Math.min(timeline.totalSec, Math.max(0, time));
  const pointIndex = segmentAt(timeline, t);
  const seg = timeline.segments[pointIndex]!;
  const ball = ballAt(seg.point, t - seg.zero, timeline.surface);
  const over = pointIndex === timeline.segments.length - 1 && t >= seg.end;
  return {
    t,
    pointIndex,
    ball,
    players: { A: playerPose(timeline, 'A', t, ball), B: playerPose(timeline, 'B', t, ball) },
    scoreBug: scoreBugModel(scoreAt(timeline, t), timeline.names, { noAd: timeline.noAd, winner: over ? timeline.winner : null }),
  };
}
