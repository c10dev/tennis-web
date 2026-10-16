// Where each broadcast camera stands and looks for a frame (GDD §8.1). Pure: Three coordinates out, no Three objects.
import type { Vec3 } from '@tennis/engine';
import type { BroadcastFrame } from '../broadcast/frame.ts';
import { CAMERAS } from '../tuning/index.ts';
import { mainCamPose, type CamPose } from './mainCam.ts';

/** Court (x, y, height) → Three (x, height, −y). */
const three = (x: number, y: number, h: number) => ({ x, y: h, z: -y });

export type CameraFrame = Pick<BroadcastFrame, 'camera' | 'focus' | 'ball' | 'players' | 'hawkeye' | 'clip'>;

/** `aspect` is the view's width / height; only the main camera re-frames for it (fitFov widens the others). */
export function cameraPose(frame: CameraFrame, pan: number, aspect?: number): CamPose {
  switch (frame.camera) {
    case 'main':
      return mainCamPose(pan, aspect);
    case 'serve': {
      // Low behind the server, aimed down the court past them.
      const s = frame.players[frame.focus ?? 'A'].pos;
      const back = Math.sign(s.y);
      const c = CAMERAS.serve;
      const aside = s.x >= 0 ? -c.aside : c.aside;
      return { position: three(s.x + aside, s.y + back * c.behind, c.height), target: three(0, -back * 4, c.aimHeight), fov: c.fov };
    }
    case 'reaction': {
      // In front of the player, between them and the net, slightly to one side.
      const w = frame.players[frame.focus ?? 'A'].pos;
      const toNet = -Math.sign(w.y);
      const c = CAMERAS.reaction;
      const aside = w.x > 0 ? -c.aside : c.aside;
      return { position: three(w.x + aside, w.y + toNet * c.distance, c.height), target: three(w.x, w.y, c.headHeight), fov: c.fov };
    }
    case 'side':
      return frame.clip === 'replay' && frame.ball ? sideTracking(frame.ball) : sideWide();
    case 'hawkeye': {
      // Close over the mark from the court side, looking down at it.
      const m = frame.hawkeye?.mark ?? { x: 0, y: 0 };
      const c = CAMERAS.hawkeye;
      const inward = { x: -Math.sign(m.x) * c.back, y: -Math.sign(m.y) * c.back };
      return { position: three(m.x + inward.x, m.y + inward.y, c.height), target: three(m.x, m.y, 0), fov: c.fov };
    }
  }
}

function sideWide(): CamPose {
  const c = CAMERAS.side;
  return { position: three(c.x, c.y, c.height), target: three(0, 0, 0), fov: c.fov };
}

/** Replays: from the umpire's side, low, following the ball. */
function sideTracking(ball: Vec3): CamPose {
  const c = CAMERAS.side;
  return { position: three(c.replayX, ball.y * 0.4, c.replayHeight), target: three(ball.x, ball.y, ball.z), fov: c.replayFov };
}
