// Hawk-Eye line calls (GDD §8.3): how far inside (+) or outside (−) its target a bounce landed.
// The target is the service box for a serve and the singles court for a rally ball; lines are in.
import { COURT, type PointEvent, type ShotEvent, type Vec2 } from '@tennis/engine';

export interface LineCall {
  call: 'IN' | 'OUT';
  /** Metres to the nearest line of the target, positive inside. */
  marginM: number;
  mark: Vec2;
}

/** Serves go to the deuce box after an even number of points in the game (as the engine plays them). */
export function lineCall(point: PointEvent, shot: ShotEvent): LineCall | null {
  if (!shot.bounce) return null;
  const b = shot.bounce;
  const side = -Math.sign(shot.from.y);
  const depth = b.y * side;
  let marginM: number;
  if (shot.shot === 'serve') {
    const deuce = (point.scoreBefore.points[0] + point.scoreBefore.points[1]) % 2 === 0;
    // The receiver's right-hand half is x > 0 at the near end (y < 0) and x < 0 at the far end.
    const right = side < 0 ? 1 : -1;
    const across = b.x * (deuce ? right : -right);
    marginM = Math.min(across, COURT.halfWidth - across, COURT.serviceLine - depth, depth);
  } else {
    marginM = Math.min(COURT.halfWidth - Math.abs(b.x), COURT.halfLength - depth, depth);
  }
  return { call: marginM >= 0 ? 'IN' : 'OUT', marginM, mark: b };
}
