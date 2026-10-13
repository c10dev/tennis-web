// WebGL shell around a Stage: renderer, Main Cam and resizing. The only renderer file that needs a browser,
// so it is kept free of logic and not unit-tested; everything it calls is.
import { MathUtils, PerspectiveCamera, WebGLRenderer } from 'three';
import { dampPan, mainCamPose, panTarget } from './camera/mainCam.ts';
import type { Frame } from './playback/frame.ts';
import type { Timeline } from './playback/timeline.ts';
import { createStage } from './scene/stage.ts';
import { CAMERA } from './tuning.ts';

export interface Viewer {
  resize(width: number, height: number): void;
  /** Draw a frame; dt is the real time since the last draw, for camera easing. */
  render(frame: Frame, dt: number): void;
  dispose(): void;
}

export function createViewer(canvas: HTMLCanvasElement, timeline: Timeline): Viewer {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const stage = createStage(timeline);
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.5, 400);
  let pan = 0;
  return {
    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const minVertical = 2 * Math.atan(Math.tan(MathUtils.degToRad(CAMERA.minHorizontalFov) / 2) / camera.aspect);
      camera.fov = Math.max(CAMERA.fov, MathUtils.radToDeg(minVertical));
      camera.updateProjectionMatrix();
    },
    render(frame, dt) {
      stage.applyFrame(frame);
      pan = dampPan(pan, panTarget(frame.ball), dt);
      const pose = mainCamPose(pan);
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      renderer.render(stage.scene, camera);
    },
    dispose() {
      renderer.dispose();
    },
  };
}
