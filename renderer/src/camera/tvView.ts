// The TV view as a still (ADR-031, M8 phase 0): the Main camera with its pan settled where the ball wants it (the
// viewer eases towards the same place, mainCam `dampPan`) and its field of view fitted to the stage, plus a projector
// to the stage's CSS pixels so motion tests and the rig viewer can judge what a phone shows.
import { PerspectiveCamera, Vector3 } from 'three';
import type { Vec3 } from '@tennis/engine';
import { TV_STAGE } from '../tuning/index.ts';
import { fitFov } from './framing.ts';
import { mainCamPose, panTarget, type CamPose } from './mainCam.ts';

export function tvView(ball: Vec3 | null, aspect: number): CamPose {
  const pose = mainCamPose(panTarget(ball), aspect);
  return { ...pose, fov: fitFov(pose, 'main', aspect) };
}

/** Three coordinates → CSS pixels on a `width` × `height` stage (y down), through the TV view for `ball`. */
export function tvProjector(ball: Vec3 | null, width: number = TV_STAGE.width, height: number = TV_STAGE.height): (p: { x: number; y: number; z: number }) => { x: number; y: number } {
  const pose = tvView(ball, width / height);
  const camera = new PerspectiveCamera(pose.fov, width / height, 0.1, 400);
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  camera.updateMatrixWorld(true);
  const v = new Vector3();
  return (p) => {
    v.set(p.x, p.y, p.z).project(camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  };
}
