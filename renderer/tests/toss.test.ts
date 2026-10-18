// The serve's free hand and the ball (ADR-031 A3): the server holds the ball before the toss and lifts it to the
// release, so the free hand's key follows the ball until then; the serve's stroke starts a little before the toss,
// in the walk to the line, so the hand is on the ball when it appears.
import { describe, expect, it } from 'vitest';
import { playerPose } from '../src/playback/pose.ts';
import { toLocal } from '../src/playback/stroke.ts';
import { tossPosition } from '../src/playback/trajectory.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { BALL, PLAYBACK, STROKE } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(2, 'clay'));
const k = tl.segments.findIndex((g, i) => i > 0 && g.point.shots[0]!.shot === 'serve');
const seg = tl.segments[k]!;
const serve = seg.point.shots[0]!;
const id = serve.hitter;
const tossAt = seg.zero + serve.t - PLAYBACK.tossLeadSec;

describe('the serve’s free hand', () => {
  it('starts the serve before the toss, in the walk to the line', () => {
    const before = playerPose(tl, id, tossAt - STROKE.serve.preTossSec / 2);
    expect(before.stroke?.kind).toBe('serve');
    expect(before.stroke!.weight).toBeGreaterThan(0);
    expect(playerPose(tl, id, tossAt).stroke!.weight).toBeCloseTo(1, 6);
  });

  it('holds the ball from the toss to its release: the free hand’s key is under the ball', () => {
    for (const u of [0, 0.1, 0.2, BALL.toss.releaseShare - 0.01]) {
      const t = tossAt + u * PLAYBACK.tossLeadSec;
      const p = playerPose(tl, id, t);
      const ball = toLocal(tossPosition(serve, u), p.pos, p.facing);
      const free = p.stroke!.keys.free;
      expect(Math.hypot(free.x - ball.x, free.y - (ball.y - BALL.toss.palm), free.z - ball.z), `u ${u}`).toBeLessThan(1e-6);
    }
  });

  it('lets go of it after the release and goes back to the serve’s keys', () => {
    const t = tossAt + (BALL.toss.releaseShare + 0.3) * PLAYBACK.tossLeadSec;
    const p = playerPose(tl, id, t);
    const ball = toLocal(tossPosition(serve, BALL.toss.releaseShare + 0.3), p.pos, p.facing);
    const free = p.stroke!.keys.free;
    expect(Math.hypot(free.x - ball.x, free.y - ball.y, free.z - ball.z)).toBeGreaterThan(0.2);
  });
});
