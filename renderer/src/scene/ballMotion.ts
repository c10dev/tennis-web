// Pure helpers for the ball's look over time: contact pop and trail samples, functions of point time τ alone so a
// seek or a replay draws exactly what live playback drew (ADR-019).
import type { PointEvent, Surface, Vec3 } from '@tennis/engine';
import { ballAt } from '../playback/ball.ts';
import { BALL_LOOK } from '../tuning/index.ts';

export interface TrailPoint {
  pos: Vec3;
  /** Seconds behind the ball's current position. */
  age: number;
}

/** Point time of the last racket contact at or before τ, or null before the first serve is struck. */
export function lastContact(point: PointEvent, tau: number): number | null {
  for (let i = point.shots.length - 1; i >= 0; i--) {
    if (point.shots[i]!.t <= tau) return point.shots[i]!.t;
  }
  return null;
}

/** Ball scale `since` seconds after contact: the pop, easing out; 1 when there was no contact. */
export function ballPop(since: number | null): number {
  const { scale, sec } = BALL_LOOK.pop;
  if (since === null || since < 0 || since >= sec) return 1;
  const u = 1 - since / sec;
  return 1 + (scale - 1) * u * u;
}

/** Where the ball was over the last `sec` of match time, newest first; cut at the last contact, empty before the serve. */
export function trailPoints(point: PointEvent, tau: number, surface: Surface, sec: number = BALL_LOOK.trail.sec): TrailPoint[] {
  const contact = lastContact(point, tau);
  if (contact === null) return [];
  const { samples } = BALL_LOOK.trail;
  const reach = Math.min(sec, tau - contact);
  const out: TrailPoint[] = [];
  for (let i = 0; i < samples; i++) {
    const age = (reach * i) / (samples - 1);
    const pos = ballAt(point, tau - age, surface);
    if (!pos) break;
    out.push({ pos, age });
    if (reach === 0) break;
  }
  return out;
}

/** Width (metres) and opacity of a trail `sec` long, `age` seconds behind the ball: both taper linearly to nothing at its tail. */
/** The trail's colour with the game look: the shot type of the point's last contact so far (white before one). */
export function trailColour(point: PointEvent, tau: number): number {
  const contact = lastContact(point, tau);
  const shot = contact === null ? null : point.shots.findLast((s) => s.t <= tau)!.shot;
  return (shot && BALL_LOOK.trail.byShot[shot]) ?? BALL_LOOK.trail.colour;
}

export function trailStyle(age: number, sec: number = BALL_LOOK.trail.sec): { width: number; alpha: number } {
  const { widthShare, opacity } = BALL_LOOK.trail;
  const u = Math.max(0, 1 - age / sec);
  return { width: 2 * BALL_LOOK.radius * widthShare * u, alpha: opacity * u };
}
