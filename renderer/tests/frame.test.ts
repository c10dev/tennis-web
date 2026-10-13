import { describe, expect, it } from 'vitest';
import { ballAt } from '../src/playback/ball.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { playerPose } from '../src/playback/pose.ts';
import { buildTimeline, scoreAt } from '../src/playback/timeline.ts';
import { scoreBugModel } from '../src/overlay/scoreBug.ts';
import { match } from './fixtures.ts';

describe('matchFrameAt', () => {
  const r = match(6);
  const tl = buildTimeline(r);

  it('is a pure function of the timeline and the time', () => {
    for (const t of [0, 3.2, 41.7, tl.totalSec / 2]) expect(matchFrameAt(tl, t)).toEqual(matchFrameAt(tl, t));
  });

  it('combines the ball, both poses and the score bug at that moment', () => {
    const seg = tl.segments[10]!;
    const t = seg.zero + seg.point.shots[0]!.t + 0.2;
    const f = matchFrameAt(tl, t);
    expect(f.pointIndex).toBe(10);
    expect(f.ball).toEqual(ballAt(seg.point, t - seg.zero, tl.surface));
    expect(f.players.A).toEqual(playerPose(tl, 'A', t, f.ball));
    expect(f.players.B).toEqual(playerPose(tl, 'B', t, f.ball));
    expect(f.scoreBug).toEqual(scoreBugModel(scoreAt(tl, t), tl.names, { noAd: tl.noAd, winner: null }));
  });

  it('has no ball in the pause between points', () => {
    for (const seg of tl.segments.slice(0, 20)) expect(matchFrameAt(tl, (seg.end + seg.next) / 2).ball).toBeNull();
  });

  it('crowns the winner once the last point is over, and clamps times past the end', () => {
    const last = tl.segments.at(-1)!;
    expect(matchFrameAt(tl, last.end - 0.01).scoreBug.final).toBe(false);
    const end = matchFrameAt(tl, tl.totalSec + 10);
    expect(end.t).toBe(tl.totalSec);
    expect(end.scoreBug.final).toBe(true);
    expect(end.scoreBug.rows[r.winner === 'A' ? 0 : 1].winner).toBe(true);
    expect(matchFrameAt(tl, -3).t).toBe(0);
  });
});
