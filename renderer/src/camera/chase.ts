// The game camera K2 (ADR-024): behind *my* player's end, following me. A pure function of
// the timeline and match time: its inputs are averaged over a window of replay time, not eased frame to frame, so
// seeks, replays and speeds show the same view for the same moment (ADR-007).
import { COURT, type PlayerId } from '@tennis/engine';
import { lerp, smoothstep } from '../math.ts';
import { positionAt } from '../playback/movement.ts';
import { segmentAt, type Timeline } from '../playback/timeline.ts';
import { CAMERA, CHASE } from '../tuning/index.ts';
import { horizontalFov, verticalFov } from './framing.ts';
import type { CamPose } from './mainCam.ts';

/** Which end the camera is at for time t: my end in this point, or in the next once a change of ends is half done. */
function myEnd(timeline: Timeline, me: PlayerId, t: number): number {
  const i = segmentAt(timeline, t);
  const seg = timeline.segments[i]!;
  const next = timeline.segments[i + 1];
  const point = next && t >= seg.end + (seg.next - seg.end) / 2 ? next : seg;
  return Math.sign(positionAt(timeline, me, point.zero).y) || -1;
}

export function chasePose(timeline: Timeline, me: PlayerId, t: number, aspect: number): CamPose {
  const end = myEnd(timeline, me, t);
  let mx = 0;
  let depth = 0;
  let mw = 0;
  for (let k = 0; k < CHASE.samples; k++) {
    const u = k / (CHASE.samples - 1);
    const at = Math.min(timeline.totalSec, Math.max(0, t + (2 * u - 1) * CHASE.windowSec));
    const w = smoothstep(1 - Math.abs(2 * u - 1)) + 1e-3;
    const p = positionAt(timeline, me, at);
    // A sample across the net (a change of ends) belongs to the other end's view: leave it out.
    if (Math.sign(p.y) === end) {
      mx += p.x * w;
      depth += Math.abs(p.y) * w;
      mw += w;
    }
  }
  const x = (mw ? mx / mw : 0) * CHASE.myShare;
  // Court y < 0 is Three z > 0: my end's side of the camera.
  const z = -end * ((mw ? depth / mw : COURT.halfLength) + CHASE.behind);
  return {
    position: { x, y: CHASE.height, z },
    target: { x: x * CHASE.aimShare, y: 0, z: z + end * CHASE.aim },
    fov: chaseFov(aspect),
  };
}

/** Vertical field of view: the portrait value from the phone stage's aspect up to a square view (so the framing
 * does not shift), as wide across on narrower screens, easing to the landscape value on wide ones. */
export function chaseFov(aspect: number): number {
  const P = CAMERA.portrait.aspect;
  if (aspect < P) return verticalFov(horizontalFov(CHASE.fov.portrait, P), aspect);
  const wide = Math.min(1, Math.max(0, (aspect - 1) / (CAMERA.landscapeAspect - 1)));
  return lerp(CHASE.fov.portrait, CHASE.fov.landscape, wide);
}

