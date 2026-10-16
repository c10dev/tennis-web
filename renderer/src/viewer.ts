// WebGL shell around a Stage: renderer, broadcast cameras and resizing. The only renderer file that needs a browser,
// so it is kept free of logic and not unit-tested; everything it calls is.
import { PerspectiveCamera, WebGLRenderer } from 'three';
import type { BroadcastFrame } from './broadcast/frame.ts';
import type { CameraId } from './broadcast/types.ts';
import { cameraPose } from './camera/cameras.ts';
import { fitFov } from './camera/framing.ts';
import { dampPan, panTarget } from './camera/mainCam.ts';
import type { Timeline } from './playback/timeline.ts';
import { createFrameMeter, tierSettings, type QualityTier } from './quality.ts';
import type { PlayerModel } from './scene/playerModel.ts';
import { createStage } from './scene/stage.ts';
import { CAMERA } from './tuning/index.ts';

export interface Viewer {
  resize(width: number, height: number): void;
  /** Draw a frame; dt is the real time since the last draw, for camera easing. */
  render(frame: BroadcastFrame, dt: number): void;
  dispose(): void;
}

/**
 * `tier` is the quality to start on (M7, ADR-022); antialiasing is fixed by it, the rest can change. The viewer
 * measures its frames and steps down to low once if they stay slow, telling `onTier`.
 */
export function createViewer(
  canvas: HTMLCanvasElement, timeline: Timeline, tier: QualityTier = 'high', onTier?: (tier: QualityTier) => void, model: PlayerModel | null = null,
): Viewer {
  const renderer = new WebGLRenderer({ canvas, antialias: tierSettings(tier).antialias });
  const stage = createStage(timeline, { model });
  const meter = createFrameMeter(tier);
  let size = { w: 0, h: 0 };
  const apply = (t: QualityTier) => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tierSettings(t).dprCap));
    if (size.w) renderer.setSize(size.w, size.h, false);
    stage.setQuality(t);
  };
  apply(tier);
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.3, 400);
  let pan = 0;
  let shown: CameraId | null = null;
  let projected = { fov: 0, aspect: 0 };
  return {
    resize(width, height) {
      size = { w: width, h: height };
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      stage.setAspect(camera.aspect);
    },
    render(frame, dt) {
      if (meter.push(dt)) {
        apply(meter.tier);
        onTier?.(meter.tier);
      }
      stage.applyFrame(frame);
      // A cut starts the pan where it wants to be; within a shot it eases there.
      pan = frame.camera === shown ? dampPan(pan, panTarget(frame.ball), dt) : panTarget(frame.ball);
      shown = frame.camera;
      // The frame follows the view's shape (M7): an upright phone gets the portrait main camera, every camera a
      // minimum width; the projection is rebuilt when the field of view or the shape changes.
      const pose = cameraPose(frame, pan, camera.aspect);
      camera.fov = fitFov(pose, frame.camera, camera.aspect);
      if (camera.fov !== projected.fov || camera.aspect !== projected.aspect) {
        camera.updateProjectionMatrix();
        projected = { fov: camera.fov, aspect: camera.aspect };
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
