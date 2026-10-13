// Presentation geometry: positions, bounces, speeds and spins that match an outcome already decided (ADR-002).
// Results never depend on these numbers; they only have to be consistent with the outcome.
import { range, type Rng } from '../rng/mulberry32.ts';
import { SURFACES } from '../tuning.ts';
import type { ShotType, Surface, Vec2, Vec3 } from '../types.ts';
import { COURT, rightSign, type Side } from './court.ts';
import type { ServeTarget } from './serve.ts';
import type { TargetSide } from './shotSelection.ts';
import type { Risk } from '../tuning.ts';

export interface Landing {
  bounce?: Vec2;
  netClearance: number;
}

const signed = (sign: number, magnitude: number) => sign * magnitude;

/** Where the server stands for a serve to the deuce or advantage court. */
export function servePosition(rng: Rng, side: Side, deuce: boolean): Vec2 {
  const x = (deuce ? rightSign(side) : -rightSign(side)) * range(rng, 0.3, 1.0);
  return { x, y: side * (COURT.halfLength + range(rng, 0.1, 0.4)) };
}

export function returnPosition(rng: Rng, side: Side, deuce: boolean): Vec2 {
  const x = (deuce ? rightSign(side) : -rightSign(side)) * range(rng, 1.5, 3.0);
  return { x, y: side * (COURT.halfLength + range(rng, 0.3, 2.0)) };
}

/** Serve contact above the server; a ground stroke is met around `ball`, the point on the ball's path. */
export function contactPoint(rng: Rng, pos: Vec2, side: Side, serve: boolean, ball: Vec2 = pos): Vec3 {
  if (serve) return { x: pos.x, y: pos.y - side * 0.3, z: range(rng, 2.6, 2.95) };
  return { x: ball.x + range(rng, -0.15, 0.15), y: ball.y - side * range(rng, 0, 0.3), z: range(rng, 0.6, 1.4) };
}

/** A missed shot: into the net half the time it is not long or wide. */
function miss(rng: Rng, receiverSide: Side, xSign: number, netShare: number, depth: number, width: number): Landing {
  if (rng.next() < netShare) return { netClearance: -range(rng, 0.03, 0.4) };
  if (rng.next() < 0.6) {
    return { bounce: { x: signed(xSign, range(rng, 0.3, width)), y: receiverSide * (depth + range(rng, 0.005, 1.4)) }, netClearance: range(rng, 0.4, 1.8) };
  }
  return { bounce: { x: signed(xSign, COURT.halfWidth + range(rng, 0.005, 1.1)), y: receiverSide * range(rng, 3, depth) }, netClearance: range(rng, 0.3, 1.5) };
}

export function serveLanding(rng: Rng, receiverSide: Side, deuce: boolean, target: ServeTarget, good: boolean): Landing {
  const boxSign = deuce ? rightSign(receiverSide) : -rightSign(receiverSide);
  if (!good) return miss(rng, receiverSide, boxSign, 0.4, COURT.serviceLine, COURT.halfWidth - 0.1);
  // Good serves may land on the lines (lines are in): Hawk-Eye needs close calls.
  const lateral = target === 'wide' ? range(rng, 3.0, COURT.halfWidth) : target === 't' ? range(rng, 0.001, 1.0) : range(rng, 1.2, 2.8);
  return { bounce: { x: boxSign * lateral, y: receiverSide * range(rng, 3.8, COURT.serviceLine) }, netClearance: range(rng, 0.1, 0.9) };
}

/** Ground stroke landing on the receiver's forehand, backhand or middle (receiver assumed right-handed). */
export function rallyLanding(rng: Rng, receiverSide: Side, target: TargetSide, good: boolean): Landing {
  const forehandSign = rightSign(receiverSide);
  const xSign = target === 'forehand' ? forehandSign : target === 'backhand' ? -forehandSign : rng.next() < 0.5 ? 1 : -1;
  if (!good) return miss(rng, receiverSide, xSign, 0.35, COURT.halfLength, COURT.halfWidth - 0.2);
  const lateral = target === 'middle' ? range(rng, 0.05, 1.2) : range(rng, 1.2, COURT.halfWidth);
  return { bounce: { x: xSign * lateral, y: receiverSide * range(rng, 5, COURT.halfLength) }, netClearance: range(rng, 0.2, 1.5) };
}

/** Where the hitter recovers to after a shot: towards the middle behind the baseline, as far as `reach` allows. */
export function recoverPosition(rng: Rng, pos: Vec2, side: Side, reach: number): Vec2 {
  const target = { x: pos.x * 0.3 + range(rng, -0.5, 0.5), y: side * (COURT.halfLength + range(rng, 0.3, 1.5)) };
  const d = Math.hypot(target.x - pos.x, target.y - pos.y);
  if (d <= reach) return target;
  return { x: pos.x + ((target.x - pos.x) * reach) / d, y: pos.y + ((target.y - pos.y) * reach) / d };
}

export function speedKmh(rng: Rng, shot: ShotType, skill: number, surface: Surface, risk: Risk = 'neutral', second = false): number {
  let base: number;
  if (shot === 'serve') base = second ? 125 + 35 * skill : 150 + 60 * skill;
  else base = (shot === 'return' ? 85 : 95) + 40 * skill + (risk === 'safe' ? -10 : risk === 'aggressive' ? 12 : 0);
  return Math.min(240, Math.max(50, (base + range(rng, -8, 8)) * SURFACES[surface].speed));
}

export function spinRpm(rng: Rng, shot: ShotType, risk: Risk = 'neutral', second = false): number {
  if (shot === 'serve') return second ? range(rng, 2600, 3600) : range(rng, 900, 2400);
  const [lo, hi] = risk === 'safe' ? [2400, 3400] : risk === 'aggressive' ? [1200, 2200] : [1800, 2800];
  return range(rng, lo, hi);
}

/** Average ground speed of a shot hit at `speed` km/h, m/s. */
export const groundSpeed = (speed: number): number => (speed / 3.6) * 0.75;

/** Seconds from contact to the bounce (or the net). */
export function flightSec(from: Vec3, landing: Landing, speed: number): number {
  const metresPerSec = groundSpeed(speed);
  const to = landing.bounce ?? { x: from.x * 0.5, y: 0 };
  return Math.hypot(to.x - from.x, to.y - from.y) / metresPerSec;
}
