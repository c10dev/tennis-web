// The whole Three.js scene for one match; applyFrame() moves everything to a Frame. No WebGL here (ADR-007).
import { AmbientLight, Color, DirectionalLight, HemisphereLight, Scene } from 'three';
import type { Frame } from '../playback/frame.ts';
import type { Timeline } from '../playback/timeline.ts';
import { COLOURS } from '../tuning/index.ts';
import { createBall } from './ball.ts';
import { buildCourt } from './court.ts';
import { CapsuleRig, type PlayerRig } from './rig.ts';

export interface Stage {
  readonly scene: Scene;
  applyFrame(frame: Frame): void;
}

export function createStage(timeline: Timeline): Stage {
  const scene = new Scene();
  scene.background = new Color(COLOURS.background);
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-20, 40, 15);
  scene.add(new HemisphereLight(0xdfe8ff, 0x3a4030, 1.1), new AmbientLight(0xffffff, 0.25), sun);
  scene.add(buildCourt(timeline.surface));
  const rigs: Record<'A' | 'B', PlayerRig> = { A: new CapsuleRig(COLOURS.players.A), B: new CapsuleRig(COLOURS.players.B) };
  rigs.A.object3d.name = 'player-A';
  rigs.B.object3d.name = 'player-B';
  const ball = createBall();
  scene.add(rigs.A.object3d, rigs.B.object3d, ball.object3d);
  return {
    scene,
    applyFrame(frame) {
      rigs.A.apply(frame.players.A);
      rigs.B.apply(frame.players.B);
      ball.apply(frame.ball);
    },
  };
}
