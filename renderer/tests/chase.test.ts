// The game camera K2 (ADR-024, slice step 4): behind *my* player, my player large at the bottom, the far court whole
// below the score-bug band, smooth because its inputs are windowed over the timeline (closed-form in time).
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { COURT, type PlayerId } from '@tennis/engine';
import { chasePose } from '../src/camera/chase.ts';
import { ballAt } from '../src/playback/ball.ts';
import { positionAt } from '../src/playback/movement.ts';
import { buildTimeline, type Timeline } from '../src/playback/timeline.ts';
import { groundToThree } from '../src/scene/coords.ts';
import { SAMPLE } from './fixtures.ts';

function camera(tl: Timeline, me: PlayerId, t: number, aspect: number): PerspectiveCamera {
  const pose = chasePose(tl, me, t, aspect);
  const c = new PerspectiveCamera(pose.fov, aspect, 0.3, 400);
  c.position.set(pose.position.x, pose.position.y, pose.position.z);
  c.lookAt(pose.target.x, pose.target.y, pose.target.z);
  c.updateMatrixWorld(true);
  return c;
}
/** Screen position as shares of the view: x 0 (left) → 1, y 0 (top) → 1. */
const onScreen = (c: PerspectiveCamera, p: Vector3) => {
  const v = p.clone().project(c);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
};

/** Live moments: every 0.25 s while a point's ball is in play, over the first points of each sample match. */
function* live(points = 25): Generator<{ tl: Timeline; t: number }> {
  for (const r of SAMPLE.slice(0, 3)) {
    const tl = buildTimeline(r);
    for (const seg of tl.segments.slice(0, points)) {
      for (let tau = -0.8; seg.zero + tau < seg.end; tau += 0.25) if (ballAt(seg.point, tau, tl.surface)) yield { tl, t: seg.zero + tau };
    }
  }
}

describe('chase camera framing', () => {
  for (const aspect of [0.75, 0.82, 0.85, 0.95]) {
    it(`keeps me large at the bottom and the far court below the score-bug band at aspect ${aspect}`, () => {
      let n = 0;
      for (const { tl, t } of live()) {
        const c = camera(tl, 'A', t, aspect);
        const me = positionAt(tl, 'A', t);
        const them = positionAt(tl, 'B', t);
        const feet = onScreen(c, groundToThree(me));
        const head = onScreen(c, groundToThree(me, 1.8));
        expect(feet.y, `feet at ${t}`).toBeLessThanOrEqual(0.92);
        expect(head.y, `head at ${t}`).toBeGreaterThanOrEqual(0.3);
        expect(feet.x).toBeGreaterThan(0.03);
        expect(feet.x).toBeLessThan(0.97);
        const far = onScreen(c, groundToThree({ x: 0, y: -Math.sign(me.y) * COURT.halfLength }));
        expect(far.y, `far baseline at ${t}`).toBeGreaterThanOrEqual(0.25);
        const opp = onScreen(c, groundToThree(them));
        expect(opp.x, `opponent at ${t}`).toBeGreaterThan(0.03);
        expect(opp.x, `opponent at ${t}`).toBeLessThan(0.97);
        n++;
      }
      expect(n).toBeGreaterThan(500);
    });
  }
});

describe('chase camera motion', () => {
  it('moves less than 0.25 m and turns less than 0.03 rad between 60 fps frames inside a point', () => {
    const tl = buildTimeline(SAMPLE[1]!);
    for (const seg of tl.segments.slice(0, 30)) {
      let prev: PerspectiveCamera | null = null;
      for (let t = seg.start; t < seg.end; t += 1 / 60) {
        const c = camera(tl, 'A', t, 0.82);
        if (prev) {
          expect(c.position.distanceTo(prev.position), `${t}`).toBeLessThan(0.25);
          expect(c.getWorldDirection(new Vector3()).angleTo(prev.getWorldDirection(new Vector3())), `${t}`).toBeLessThan(0.03);
        }
        prev = c;
      }
    }
  });

  it('stands behind my baseline at every point, whichever end I am at', () => {
    for (const me of ['A', 'B'] as const) {
      const tl = buildTimeline(SAMPLE[0]!);
      for (const seg of tl.segments) {
        const pose = chasePose(tl, me, seg.zero, 0.82);
        const my = positionAt(tl, me, seg.zero);
        // Court y < 0 is Three z > 0: the camera sits further out than the baseline on my side.
        expect(Math.sign(pose.position.z), `${me} point ${seg.point.index}`).toBe(-Math.sign(my.y));
        expect(Math.abs(pose.position.z)).toBeGreaterThan(COURT.halfLength);
      }
    }
  });
});
