// The racket smear (ADR-024 S3, TD-063): in the impact moment a ribbon along the path the hitter's racket head swept
// just before, drawn like the ball's trail. Poses are a function of time, so the rig is re-posed at the earlier times
// and then put back: a handful of extra solves, only while the moment is on screen.
import { Vector3, type Mesh } from 'three';
import type { PlayerId } from '@tennis/engine';
import { playerPose } from '../playback/pose.ts';
import type { Timeline } from '../playback/timeline.ts';
import { BALL_LOOK, IMPACT_LOOK } from '../tuning/index.ts';
import type { TrailPoint } from './ballMotion.ts';
import type { PlayerRig } from './rig.ts';
import { createTrail } from './trail.ts';

/** Racket-head positions (court coordinates) at replay time t and the times before it, newest first. */
export function racketPath(timeline: Timeline, id: PlayerId, t: number, rig: PlayerRig): TrailPoint[] {
  const { samples, sec } = IMPACT_LOOK.smear;
  const head = rig.object3d.getObjectByName('racket-head');
  if (!head) return [];
  const out: TrailPoint[] = [];
  const v = new Vector3();
  for (let i = 0; i < samples; i++) {
    const age = (i * sec) / (samples - 1);
    rig.apply(playerPose(timeline, id, t - age));
    rig.object3d.updateMatrixWorld(true);
    v.setFromMatrixPosition(head.matrixWorld);
    // Three (x, height, −y) → court (x, y, height).
    out.push({ pos: { x: v.x, y: -v.z, z: v.y }, age });
  }
  rig.apply(playerPose(timeline, id, t));
  return out;
}

export interface Smear {
  readonly object3d: Mesh;
  /** Show the smear of the deciding shot's hitter at match time `matchT`, or hide it (`show` false). */
  apply(timeline: Timeline, pointIndex: number, matchT: number, show: boolean, rigs: Record<PlayerId, PlayerRig>): void;
}

export function createSmear(): Smear {
  const ribbon = createTrail();
  ribbon.object3d.name = 'racket-smear';
  const S = IMPACT_LOOK.smear;
  // The ribbon's width is the ball's (2 r × widthShare) times its scale.
  const scale = S.width / (2 * BALL_LOOK.radius * BALL_LOOK.trail.widthShare);
  return {
    object3d: ribbon.object3d,
    apply(timeline, pointIndex, matchT, show, rigs) {
      const seg = timeline.segments[pointIndex];
      const shot = seg?.point.shots.at(-1);
      if (!show || !seg || !shot || matchT > seg.zero + shot.t + S.fadeSec) {
        ribbon.apply([], 1, S.sec);
        return;
      }
      ribbon.apply(racketPath(timeline, shot.hitter, matchT, rigs[shot.hitter]), scale, S.sec, S.colour);
    },
  };
}
