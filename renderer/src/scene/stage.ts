// The whole Three.js scene for one match; applyFrame() moves everything to a Frame. No WebGL here (ADR-007).
import { CircleGeometry, Mesh, MeshBasicMaterial, Scene } from 'three';
import type { LineCall } from '../broadcast/hawkeye.ts';
import type { CameraId, ClipKind } from '../broadcast/types.ts';
import { portraitBallScale } from '../camera/framing.ts';
import { tierSettings, type QualityTier } from '../quality.ts';
import { isOutline } from './outline.ts';
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

/** A frame, plus what a broadcast frame adds: the Hawk-Eye call, camera, clip kind and match second (its t is programme time). */
export type StageFrame = Frame & { hawkeye?: LineCall | null; camera?: CameraId; clip?: ClipKind; matchT?: number };

export interface Stage {
  readonly scene: Scene;
  applyFrame(frame: StageFrame): void;
  /** The view's width / height: an upright phone draws the ball larger (portraitBallScale). */
  setAspect(aspect: number): void;
  /** Shows or hides what the tier leaves out: the ink outlines and the sky dome. */
  setQuality(tier: QualityTier): void;
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
  let ballScale = 1;
  const mark = new Mesh(new CircleGeometry(BALL.radius * 1.6, 16), new MeshBasicMaterial({ color: COLOURS.mark, transparent: true, opacity: 0.85 }));
  mark.rotation.x = -Math.PI / 2;
  mark.scale.set(1.6, 1, 1);
  mark.name = 'ball-mark';
  mark.visible = false;
  scene.add(rigs.A.object3d, rigs.B.object3d, ball.object3d, mark);
  return {
    scene,
    setAspect(aspect) {
      ballScale = portraitBallScale(aspect);
    },
    setQuality(tier) {
      const { outlines, sky } = tierSettings(tier);
      scene.traverse((o) => {
        if (isOutline(o)) o.visible = outlines;
      });
      scene.getObjectByName('sky')!.visible = sky;
    },
    applyFrame(frame) {
      rigs.A.apply(frame.players.A);
      rigs.B.apply(frame.players.B);
      ball.apply(frame.ball, ballLook(timeline, frame, ballScale));
      mark.visible = !!frame.hawkeye;
      if (frame.hawkeye) mark.position.copy(groundToThree(frame.hawkeye.mark, 0.006));
    },
  };
}

/** Camera scale, contact pop and trail for the ball in this frame. */
function ballLook(timeline: Timeline, frame: StageFrame, aspectScale: number): BallLook {
  const scale = BALL_LOOK.cameraScale[frame.camera ?? 'main'] * aspectScale;
  const trailSec = BALL_LOOK.trail.sec * (frame.clip === 'replay' ? BALL_LOOK.trail.replayShare : 1);
  const seg = timeline.segments[frame.pointIndex];
  if (!seg || !frame.ball) return { scale, pop: 1, trail: [], trailSec };
  const tau = (frame.matchT ?? frame.t) - seg.zero;
  const contact = lastContact(seg.point, tau);
  return { scale, pop: ballPop(contact === null ? null : tau - contact), trail: trailPoints(seg.point, tau, timeline.surface, trailSec), trailSec };
}
