// Where a player meets a ball that bounced: on its path past the bounce, as fast as it comes off the court, and no
// further from where they stood than they can run in the time available (TD-006, TD-011, ADR-008).
import { range, type Rng } from '../rng/mulberry32.ts';
import { GEOMETRY } from '../tuning.ts';
import type { Surface, Vec2, Vec3, Wing } from '../types.ts';
import { COURT, rightSign, type Side } from './court.ts';
import { groundSpeed } from './geometry.ts';

export interface ChaseInput {
  bounce: Vec2;
  /** Contact point and speed of the incoming shot. */
  from: Vec3;
  speedKmh: number;
  surface: Surface;
  /** Side and position of the player going for the ball, and seconds from their last recorded position to the bounce. */
  side: Side;
  player: Vec2;
  sinceKey: number;
  wing: Wing;
  returning: boolean;
}

export interface Chase {
  /** Where the player stands at contact. */
  pos: Vec2;
  /** Where the ball is met, on its path. */
  contact: Vec2;
  bounceToContact: number;
}

const SAMPLES = 32;

/** Draws exactly two numbers, like every version of this function before it, so results never move. */
export function chase(rng: Rng, c: ChaseInput): Chase {
  const jitter = range(rng, -GEOMETRY.lateralJitter, GEOMETRY.lateralJitter);
  const [stepLo, stepHi] = c.returning ? GEOMETRY.stepIn.return : GEOMETRY.stepIn.rally;
  const step = range(rng, stepLo, stepHi);

  const len = Math.hypot(c.bounce.x - c.from.x, c.bounce.y - c.from.y);
  const u = { x: (c.bounce.x - c.from.x) / len, y: (c.bounce.y - c.from.y) / len };
  const offBounce = groundSpeed(c.speedKmh) * GEOMETRY.bounceRetain[c.surface];
  const dHi = offBounce * GEOMETRY.maxContactSec;
  const dLo = Math.min(dHi, Math.max(GEOMETRY.minContactDistance, offBounce * GEOMETRY.minContactSec));
  const racketSide = rightSign(c.side) * (c.wing === 'forehand' ? 1 : -1);

  const at = (d: number) => {
    const contact = { x: c.bounce.x + u.x * d, y: c.bounce.y + u.y * d };
    const pos = { x: contact.x - racketSide * GEOMETRY.contactSideOffset + jitter, y: contact.y };
    const need = Math.hypot(pos.x - c.player.x, pos.y - c.player.y) / (c.sinceKey + d / offBounce);
    return { d, contact, pos, need };
  };

  // Prefer meeting the ball at the player's own depth, stepped in or back; otherwise the nearest reachable point.
  const preferred = (Math.abs(c.player.y) - step - Math.abs(c.bounce.y)) / Math.abs(u.y);
  let best = at(Math.min(dHi, Math.max(dLo, preferred)));
  if (best.need > GEOMETRY.maxRunSpeed) {
    for (let i = 0; i <= SAMPLES; i++) {
      const cand = at(dLo + ((dHi - dLo) * i) / SAMPLES);
      const fits = cand.need <= GEOMETRY.maxRunSpeed;
      const bestFits = best.need <= GEOMETRY.maxRunSpeed;
      if ((fits && (!bestFits || Math.abs(cand.d - preferred) < Math.abs(best.d - preferred))) || (!fits && !bestFits && cand.need < best.need)) {
        best = cand;
      }
    }
  }
  const time = c.sinceKey + best.d / offBounce;
  return { pos: limitRun(c.player, onOwnSide(best.pos, c.side), GEOMETRY.maxRunSpeed * time), contact: best.contact, bounceToContact: best.d / offBounce };
}

/** Keep a target on the player's side and inside the run-off. */
function onOwnSide(p: Vec2, side: Side): Vec2 {
  const depth = Math.min(Math.max(Math.abs(p.y), 1), COURT.halfLength + GEOMETRY.maxBehindBaseline);
  const wide = COURT.halfWidth + GEOMETRY.maxWide;
  return { x: Math.min(wide, Math.max(-wide, p.x)), y: side * depth };
}

/** Move from `from` towards `to`, at most `reach` metres (a ball out of reach is lunged at, not run down). */
export function limitRun(from: Vec2, to: Vec2, reach: number): Vec2 {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  if (d <= reach) return to;
  const k = reach / d;
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}
