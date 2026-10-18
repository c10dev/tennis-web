// Ball arcs between the points a ShotEvent records: contact, net crossing, bounce (engine coordinates, z up).
import type { ShotEvent, Vec3 } from '@tennis/engine';
import { lerp } from '../math.ts';
import { BALL, NET, PLAYBACK } from '../tuning/index.ts';

/** Fraction of the contact → bounce path at which the ball crosses the net (y = 0); null for a ball into the net. */
export function netCrossing(shot: ShotEvent): number | null {
  if (!shot.bounce) return null;
  return shot.from.y / (shot.from.y - shot.bounce.y);
}

/**
 * Ball position at fraction u (0–1) of the flight. Height is a quadratic in u through the contact height, the net
 * crossing height (tape + netClearance) and the ground at the bounce. A fit that would bend upwards, which is the only
 * way it could dip below the ground, is flattened to a straight line, which crosses the net higher than recorded.
 */
export function flightPosition(shot: ShotEvent, u: number): Vec3 {
  const { from } = shot;
  const netHeight = NET.centerHeight + shot.netClearance;
  if (!shot.bounce) {
    // Into the net: on to the tape height recorded, at half the contact x (as the engine times it).
    const z = lerp(from.z, netHeight, u) + BALL.netArc * 4 * u * (1 - u);
    return { x: lerp(from.x, from.x * 0.5, u), y: lerp(from.y, 0, u), z };
  }
  const s = netCrossing(shot)!;
  const valid = s > 0 && s < 1;
  const a = valid ? Math.min(0, (from.z * (1 - s) - netHeight) / (s * (1 - s))) : 0;
  const b = -from.z - a;
  return { x: lerp(from.x, shot.bounce.x, u), y: lerp(from.y, shot.bounce.y, u), z: from.z + b * u + a * u * u };
}

/** Height at time dt of a ball under gravity that goes from z0 to z1 in T seconds. */
export function gravityArc(z0: number, z1: number, T: number, dt: number): number {
  const vz = (z1 - z0 + (BALL.gravity * T * T) / 2) / T;
  return z0 + vz * dt - (BALL.gravity * dt * dt) / 2;
}

/** Serve toss at fraction u (0–1) of the toss lead (ADR-031 A3): in the free hand in front of the server, lifted to the
 *  release (speeding up as an arm does), then flown onto the contact point. */
export function tossPosition(serve: ShotEvent, u: number): Vec3 {
  const B = BALL.toss;
  // The server faces the net: (0, net); their left is (−net, 0).
  const net = -Math.sign(serve.hitterPos.y) || 1;
  const hold = { x: serve.hitterPos.x - net * B.hold.left, y: serve.hitterPos.y + net * B.hold.forward };
  if (u <= B.releaseShare) {
    const k = Math.max(0, u / B.releaseShare);
    return { ...hold, z: B.hold.height + (B.releaseHeight - B.hold.height) * k * k };
  }
  const T = (1 - B.releaseShare) * PLAYBACK.tossLeadSec;
  const dt = (u - B.releaseShare) * PLAYBACK.tossLeadSec;
  const w = dt / T;
  return { x: hold.x + (serve.from.x - hold.x) * w, y: hold.y + (serve.from.y - hold.y) * w, z: gravityArc(B.releaseHeight, serve.from.z, T, dt) };
}
