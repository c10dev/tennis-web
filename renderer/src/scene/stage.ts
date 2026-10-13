// The whole Three.js scene for one match; applyFrame() moves everything to a Frame. No WebGL here (ADR-007).
import { CircleGeometry, Mesh, MeshBasicMaterial, Scene } from 'three';
import type { LineCall } from '../broadcast/hawkeye.ts';
import type { CameraId } from '../broadcast/types.ts';
import type { Frame } from '../playback/frame.ts';
import type { Timeline } from '../playback/timeline.ts';
import { BALL, BALL_LOOK, COLOURS } from '../tuning/index.ts';
import { createBall, type BallLook } from './ball.ts';
import { ballPop, lastContact, trailPoints } from './ballMotion.ts';
import { groundToThree } from './coords.ts';
import { buildCourt } from './court.ts';
import { addDaylight } from './daylight.ts';
import { MannequinRig, type PlayerRig } from './rig.ts';
import { buildVenue } from './venue.ts';

/** A frame, plus what a broadcast frame adds: the Hawk-Eye call, the camera, and the match second (its t is programme time). */
export type StageFrame = Frame & { hawkeye?: LineCall | null; camera?: CameraId; matchT?: number };

export interface Stage {
  readonly scene: Scene;
  applyFrame(frame: StageFrame): void;
}

export function createStage(timeline: Timeline): Stage {
  const scene = new Scene();
  addDaylight(scene);
  scene.add(buildCourt(timeline.surface), buildVenue(timeline.surface));
  const kit = COLOURS.kits[timeline.surface];
  const rigs: Record<'A' | 'B', PlayerRig> = { A: new MannequinRig(kit.A), B: new MannequinRig(kit.B) };
  rigs.A.object3d.name = 'player-A';
  rigs.B.object3d.name = 'player-B';
  const ball = createBall();
  const mark = new Mesh(new CircleGeometry(BALL.radius * 1.6, 16), new MeshBasicMaterial({ color: COLOURS.mark, transparent: true, opacity: 0.85 }));
  mark.rotation.x = -Math.PI / 2;
  mark.scale.set(1.6, 1, 1);
  mark.name = 'ball-mark';
  mark.visible = false;
  scene.add(rigs.A.object3d, rigs.B.object3d, ball.object3d, mark);
  return {
    scene,
    applyFrame(frame) {
      rigs.A.apply(frame.players.A);
      rigs.B.apply(frame.players.B);
      ball.apply(frame.ball, ballLook(timeline, frame));
      mark.visible = !!frame.hawkeye;
      if (frame.hawkeye) mark.position.copy(groundToThree(frame.hawkeye.mark, 0.006));
    },
  };
}

/** Camera scale, contact pop and trail for the ball in this frame. */
function ballLook(timeline: Timeline, frame: StageFrame): BallLook {
  const scale = BALL_LOOK.cameraScale[frame.camera ?? 'main'];
  const seg = timeline.segments[frame.pointIndex];
  if (!seg || !frame.ball) return { scale, pop: 1, trail: [] };
  const tau = (frame.matchT ?? frame.t) - seg.zero;
  const contact = lastContact(seg.point, tau);
  return { scale, pop: ballPop(contact === null ? null : tau - contact), trail: trailPoints(seg.point, tau, timeline.surface) };
}
