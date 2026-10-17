// The impact camera (ADR-024 S3, M3 frame): held still for the whole moment, in front of the hitter on the racket side
// of the deciding shot, aimed at the contact point; the player, racket and star stay in frame as the ball leaves.
import type { ClipKind } from '../broadcast/types.ts';
import { BROADCAST, CAMERAS, IMPACT_LOOK } from '../tuning/index.ts';
import type { Timeline } from '../playback/timeline.ts';
import type { CamPose } from './mainCam.ts';

/** `moment`: the clip being shown; in the hit-stop the whole camera shakes, settling by the hold's end (TD-063). */
export function impactPose(timeline: Timeline, pointIndex: number, moment?: { clip?: ClipKind; clipT?: number }): CamPose {
  const c = CAMERAS.impact;
  const shot = timeline.segments[pointIndex]!.point.shots.at(-1)!;
  const to = shot.bounce ? { x: shot.bounce.x - shot.from.x, y: shot.bounce.y - shot.from.y } : { x: 0, y: -Math.sign(shot.from.y) };
  const n = Math.hypot(to.x, to.y) || 1;
  const dir = { x: to.x / n, y: to.y / n };
  // The hitter's right, looking along the shot, is (dir.y, −dir.x): a right-hander's forehand and serve; a backhand's
  // racket is on the left.
  const side = shot.wing === 'backhand' ? -1 : 1;
  const x = shot.from.x + dir.x * c.ahead + dir.y * c.aside * side;
  const y = shot.from.y + dir.y * c.ahead - dir.x * c.aside * side;
  const h = Math.max(c.minHeight, shot.from.z + c.rise);
  // Court (x, y, height) → Three (x, height, −y).
  const [sx, sy] = shake(moment);
  return { position: { x: x + sx, y: h + sy, z: -y }, target: { x: shot.from.x + sx, y: shot.from.z + sy, z: -shot.from.y }, fov: c.fov };
}

/** Sideways and up offset of the hit-stop shake (Three x, y), decaying to zero over the hold. */
function shake(moment?: { clip?: ClipKind; clipT?: number }): [number, number] {
  if (moment?.clip !== 'hitstop') return [0, 0];
  const t = moment.clipT ?? 0;
  const k = (1 - Math.min(1, t / BROADCAST.impact.hitstopSec)) ** 2;
  const { amp, hz } = IMPACT_LOOK.shake;
  return [amp * k * Math.sin(2 * Math.PI * hz * t), amp * k * Math.sin(2 * Math.PI * hz * 1.7 * t + 1)];
}
