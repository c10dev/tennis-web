// Where the ball is at point time τ (seconds from the first serve's contact), or null when it is out of play.
import type { PointEvent, ShotEvent, Surface, Vec3 } from '@tennis/engine';
import { BALL, PLAYBACK } from '../tuning/index.ts';
import { flightPosition, gravityArc, tossPosition } from './trajectory.ts';

export function ballAt(point: PointEvent, tau: number, surface: Surface): Vec3 | null {
  const { shots } = point;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]!;
    const start = s.shot === 'serve' ? s.t - PLAYBACK.tossLeadSec : s.t;
    if (tau >= start) return phase(s, shots[i + 1], tau, surface);
  }
  return null;
}

/**
 * The stretches of point time [from, to] when `ballAt` shows a ball. A rally is one stretch; a fault ends its own,
 * and the next serve's toss starts another, even when it starts before the fault has rolled out (TD-057).
 */
export function ballSpans(point: PointEvent): { from: number; to: number }[] {
  const { shots } = point;
  const start = (s: ShotEvent) => (s.shot === 'serve' ? s.t - PLAYBACK.tossLeadSec : s.t);
  const spans: { from: number; to: number }[] = [];
  let open = false;
  shots.forEach((s, i) => {
    const next = shots[i + 1];
    const to = next && s.outcome === 'in' ? start(next) : Math.min(s.t + s.flightSec + BALL.rollSec, next ? start(next) : Infinity);
    if (open) spans.at(-1)!.to = to;
    else spans.push({ from: start(s), to });
    open = !!next && s.outcome === 'in';
  });
  return spans;
}

/** Shot `s` owns the ball from its toss (serves) or contact until the next shot's toss or contact. */
function phase(s: ShotEvent, next: ShotEvent | undefined, tau: number, surface: Surface): Vec3 | null {
  if (tau < s.t) return tossPosition(s, (tau - (s.t - PLAYBACK.tossLeadSec)) / PLAYBACK.tossLeadSec);
  const land = s.t + s.flightSec;
  if (tau <= land) return flightPosition(s, (tau - s.t) / s.flightSec);
  const dt = tau - land;
  if (next && s.outcome === 'in') {
    // Off the bounce up to the next contact point, under gravity.
    const T = next.t - land;
    const u = dt / T;
    const b = s.bounce!;
    return { x: b.x + (next.from.x - b.x) * u, y: b.y + (next.from.y - b.y) * u, z: gravityArc(0, next.from.z, T, dt) };
  }
  if (dt > BALL.rollSec) return null;
  return s.bounce ? rollOn(s, dt, surface) : dropAtNet(s, dt);
}

/** The ball that ended the rally carries on past its bounce, hopping once at the surface's height. */
function rollOn(s: ShotEvent, dt: number, surface: Surface): Vec3 {
  const b = s.bounce!;
  const dx = b.x - s.from.x;
  const dy = b.y - s.from.y;
  const speed = (BALL.rollSpeedRetain * Math.hypot(dx, dy)) / s.flightSec;
  const k = (speed * dt) / Math.hypot(dx, dy);
  const apex = BALL.hopApex[surface];
  const hopSec = 2 * Math.sqrt((2 * apex) / BALL.gravity);
  return { x: b.x + dx * k, y: b.y + dy * k, z: dt < hopSec ? gravityArc(0, 0, hopSec, dt) : 0 };
}

/** A ball stopped by the net falls straight down just in front of it. */
function dropAtNet(s: ShotEvent, dt: number): Vec3 {
  const atNet = flightPosition(s, 1);
  const z = Math.max(0, atNet.z - (BALL.gravity * dt * dt) / 2);
  return { x: atNet.x, y: Math.sign(s.from.y) * BALL.netDropOffset, z };
}
