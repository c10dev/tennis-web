// WebGL shell around a Stage: renderer, broadcast cameras and resizing. The only renderer file that needs a browser,
// so it is kept free of logic and not unit-tested; everything it calls is.
import { MathUtils, PerspectiveCamera, WebGLRenderer } from 'three';
import type { BroadcastFrame } from './broadcast/frame.ts';
import type { CameraId } from './broadcast/types.ts';
import { cameraPose } from './camera/cameras.ts';
import { dampPan, panTarget } from './camera/mainCam.ts';
import type { Timeline } from './playback/timeline.ts';
import { createStage } from './scene/stage.ts';
import { CAMERA } from './tuning/index.ts';

export interface Viewer {
  resize(width: number, height: number): void;
  /** Draw a frame; dt is the real time since the last draw, for camera easing. */
  render(frame: BroadcastFrame, dt: number): void;
  dispose(): void;
}

/** Wide cameras keep at least CAMERA.minHorizontalFov across on narrow screens; close-ups keep their framing. */
const WIDE: ReadonlySet<CameraId> = new Set(['main', 'side']);

export function createViewer(canvas: HTMLCanvasElement, timeline: Timeline): Viewer {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const stage = createStage(timeline);
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.3, 400);
  let pan = 0;
  let shown: CameraId | null = null;
  return {
    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
    },
    render(frame, dt) {
      stage.applyFrame(frame);
      // A cut starts the pan where it wants to be; within a shot it eases there.
      pan = frame.camera === shown ? dampPan(pan, panTarget(frame.ball), dt) : panTarget(frame.ball);
      shown = frame.camera;
      const pose = cameraPose(frame, pan);
      const minVertical = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(CAMERA.minHorizontalFov) / 2) / camera.aspect));
      const fov = WIDE.has(frame.camera) ? Math.max(pose.fov, minVertical) : pose.fov;
      if (fov !== camera.fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      renderer.render(stage.scene, camera);
    },
    dispose() {
      renderer.dispose();
    },
  };
}
