// Everything drawn at replay time t, as plain data: the renderer's single source of truth (ADR-007).
import type { PlayerId, Vec3 } from '@tennis/engine';
import { clamp } from '../math.ts';
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

/** The match at replay second `time`; the score bug may show another moment's score (a replay keeps the score after). */
export function matchFrameAt(timeline: Timeline, time: number, scoreTime = time): Frame {
  const t = clamp(time, 0, timeline.totalSec);
  const pointIndex = segmentAt(timeline, t);
  const seg = timeline.segments[pointIndex]!;
  const ball = ballAt(seg.point, t - seg.zero, timeline.surface);
  const shownAt = clamp(scoreTime, 0, timeline.totalSec);
  const last = timeline.segments.at(-1)!;
  const over = shownAt >= last.end;
  return {
    t,
    pointIndex,
    ball,
    players: { A: playerPose(timeline, 'A', t), B: playerPose(timeline, 'B', t) },
    scoreBug: scoreBugModel(scoreAt(timeline, shownAt), timeline.names, { noAd: timeline.noAd, winner: over ? timeline.winner : null, games: !timeline.tiebreakOnly }),
  };
}
