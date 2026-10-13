import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { broadcastFrameAt } from '../src/broadcast/frame.ts';
import { buildProgramme } from '../src/broadcast/programme.ts';
import { cameraPose } from '../src/camera/cameras.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { buildVenue } from '../src/scene/venue.ts';
import { BALL_LOOK } from '../src/tuning/index.ts';
import { SAMPLE } from './fixtures.ts';

// TD-040: the half-speed side replay looks past the umpire chair, so the chair must not hide the ball.
const chair = new Box3().setFromObject(buildVenue('hard').getObjectByName('umpire-chair')!, true)
  .expandByScalar(BALL_LOOK.radius * BALL_LOOK.cameraScale.side);

/** True when the sight line from the camera to the ball passes through the chair. */
function hidden(camera: Vector3, ball: Vector3): boolean {
  const p = new Vector3();
  for (let k = 1; k < 60; k++) if (chair.containsPoint(p.lerpVectors(camera, ball, k / 60))) return true;
  return false;
}

/** Every 0.1 s of every side-camera replay in the sample matches: [replay frames, frames with the ball hidden]. */
function sideReplayFrames() {
  let total = 0;
  let blocked = 0;
  for (const m of SAMPLE) {
    const p = buildProgramme(buildTimeline(m), 'full');
    for (const c of p.clips.filter((x) => x.camera === 'side' && x.kind === 'replay')) {
      for (let t = c.start; t < c.start + c.duration; t += 0.1) {
        const f = broadcastFrameAt(p, t);
        if (f.camera !== 'side' || f.clip !== 'replay' || !f.ball) continue;
        const pose = cameraPose(f, 0);
        total++;
        if (hidden(new Vector3(pose.position.x, pose.position.y, pose.position.z), new Vector3(f.ball.x, f.ball.z, -f.ball.y))) blocked++;
      }
    }
  }
  return { total, blocked };
}

describe('side replay camera (TD-040)', () => {
  it('keeps the umpire chair out of the sight line to the ball', () => {
    const { total, blocked } = sideReplayFrames();
    expect(total).toBeGreaterThan(500);
    expect(blocked / total).toBeLessThan(0.005);
  });
});
