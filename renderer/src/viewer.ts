// WebGL shell around a Stage: renderer, broadcast cameras and resizing. The only renderer file that needs a browser,
// so it is kept free of logic and not unit-tested; everything it calls is.
import { PerspectiveCamera, WebGLRenderer } from 'three';
import type { PlayerId } from '@tennis/engine';
import { heldShot } from './broadcast/director.ts';
import type { BroadcastFrame } from './broadcast/frame.ts';
import type { CameraId, HoldShot } from './broadcast/types.ts';
import { cameraPose } from './camera/cameras.ts';
import { chasePose } from './camera/chase.ts';
import { impactPose } from './camera/impact.ts';
import { fitFov, framingView } from './camera/framing.ts';
import { dampPan, panTarget } from './camera/mainCam.ts';
import { heldPlayers, releasedPlayers } from './playback/hold.ts';
import type { PlayerPose } from './playback/pose.ts';
import type { Timeline } from './playback/timeline.ts';
import { createFrameMeter, tierSettings, type QualityTier } from './quality.ts';
import type { PlayerModel } from './scene/playerModel.ts';
import { createStage } from './scene/stage.ts';
import { CAMERA, HOLD_RELEASE_SEC } from './tuning/index.ts';

export interface Viewer {
  /** The canvas size; its top `topInset` pixels lie under a band the picture must not need (framing.ts `framingView`). */
  resize(width: number, height: number, topInset?: number): void;
  /** Draw a frame; dt is the real time since the last draw, for camera easing. */
  render(frame: BroadcastFrame, dt: number): void;
  /** Compiles every material's shaders off the main thread where the browser can (KHR_parallel_shader_compile), so
   *  the first frame does not stall on them (TD-037). */
  warm(): Promise<void>;
  /** Lay a shot over every frame until cleared (the decision hold, ADR-024 S2), or null to clear it. */
  hold(shot: HoldShot | null): void;
  /** The match grew under the same view (same surface): the chase and impact cameras and the stage read this one. */
  setTimeline(timeline: Timeline): void;
  /** Draw calls and triangles of the last frame drawn (budget checks, ADR-024). */
  stats(): { calls: number; triangles: number };
  dispose(): void;
}

/**
 * `tier` is the quality to start on (M7, ADR-022); antialiasing is fixed by it, the rest can change. The viewer
 * measures its frames and steps down to low once if they stay slow, telling `onTier`.
 */
export interface ViewerOptions {
  /** Skinned players (ADR-024 slice); the mannequin without them. */
  model?: PlayerModel | null;
  /** The player the chase camera follows (ADR-024); A by default. */
  me?: PlayerId;
}

export function createViewer(
  canvas: HTMLCanvasElement, first: Timeline, tier: QualityTier = 'high', onTier?: (tier: QualityTier) => void, { model = null, me = 'A' }: ViewerOptions = {},
): Viewer {
  const renderer = new WebGLRenderer({ canvas, antialias: tierSettings(tier).antialias });
  let timeline = first;
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
  let held: HoldShot | null = null;
  /** Seconds the current hold has been on screen: the ready stance's idle and sway run on it. */
  let heldFor = 0;
  /** The players last drawn, and after a ready hold its poses and the seconds since it ended (the release, ADR-030). */
  let drawn: Record<PlayerId, PlayerPose> | null = null;
  let release: { from: Record<PlayerId, PlayerPose>; for: number } | null = null;
  return {
    resize(width, height, topInset = 0) {
      size = { w: width, h: height };
      renderer.setSize(width, height, false);
      const { aspect, view } = framingView(width, height, topInset);
      camera.aspect = aspect;
      if (view) camera.setViewOffset(view.fullWidth, view.fullHeight, view.x, view.y, view.width, view.height);
      else camera.clearViewOffset();
      projected = { fov: 0, aspect: 0 };
      stage.setAspect(camera.aspect);
    },
    hold(shot) {
      if (shot !== held) heldFor = 0;
      if (held?.ready && !shot?.ready && drawn) release = { from: drawn, for: 0 };
      held = shot;
    },
    setTimeline(next) {
      timeline = next;
      stage.setTimeline(next);
    },
    stats() {
      const { calls, triangles } = renderer.info.render;
      return { calls, triangles };
    },
    render(given, dt) {
      if (meter.push(dt)) {
        apply(meter.tier);
        onTier?.(meter.tier);
      }
      const shot = heldShot(given, held);
      const frame: BroadcastFrame = { ...given, ...shot };
      if (held?.ready) {
        // The next point is not played yet: both players wait at its start, the ball out of play (TD-061).
        heldFor += dt;
        frame.players = heldPlayers(timeline, held.ready.tell, heldFor);
        frame.ball = null;
      } else if (release) {
        // The point starts where the engine put it, up to a metre from the ready spot: ease over, never jump.
        release.for += dt;
        frame.players = releasedPlayers(release.from, frame.players, release.for / HOLD_RELEASE_SEC);
        if (release.for >= HOLD_RELEASE_SEC) release = null;
      }
      drawn = frame.players;
      // A held shot without a focus must not keep the frame's (a tell on B over a close-up on A).
      if (!shot.focus) delete frame.focus;
      stage.applyFrame(frame);
      // A cut starts the pan where it wants to be; within a shot it eases there. Only the TV main camera pans: the
      // chase is a pure function of match time (ADR-024).
      pan = frame.camera === shown ? dampPan(pan, panTarget(frame.ball), dt) : panTarget(frame.ball);
      shown = frame.camera;
      // The frame follows the view's shape (M7): an upright phone gets the portrait main camera, every camera a
      // minimum width; the projection is rebuilt when the field of view or the shape changes.
      const pose = frame.camera === 'chase' ? chasePose(timeline, me, frame.matchT, camera.aspect)
        : frame.camera === 'impact' ? impactPose(timeline, frame.pointIndex, frame) : cameraPose(frame, pan, camera.aspect);
      camera.fov = frame.camera === 'chase' ? pose.fov : fitFov(pose, frame.camera, camera.aspect);
      if (camera.fov !== projected.fov || camera.aspect !== projected.aspect) {
        camera.updateProjectionMatrix();
        projected = { fov: camera.fov, aspect: camera.aspect };
      }
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      renderer.render(stage.scene, camera);
    },
    async warm() {
      await renderer.compileAsync(stage.scene, camera);
    },
    dispose() {
      renderer.dispose();
    },
  };
}
