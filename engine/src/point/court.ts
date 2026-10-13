// Singles court in metres. Origin at the centre of the net; a side is the sign of y (−1 or +1).
import type { Vec2 } from '../types.ts';

export type Side = -1 | 1;

export const COURT = {
  halfLength: 11.885,
  halfWidth: 4.115,
  serviceLine: 6.4,
} as const;

/** Inside the singles court on the given side (lines count as in). */
export function inHalf(b: Vec2, side: Side): boolean {
  return Math.sign(b.y) === side && Math.abs(b.y) <= COURT.halfLength && Math.abs(b.x) <= COURT.halfWidth;
}

/** x sign of the right-hand half for a player on `side` facing the net. */
export const rightSign = (side: Side): Side => (side === -1 ? 1 : -1);

/** Inside the receiver's deuce (right) or advantage (left) service box. */
export function inServiceBox(b: Vec2, receiverSide: Side, deuce: boolean): boolean {
  const boxSign = deuce ? rightSign(receiverSide) : -rightSign(receiverSide);
  return Math.sign(b.y) === receiverSide && Math.abs(b.y) <= COURT.serviceLine
    && Math.sign(b.x) === boxSign && Math.abs(b.x) <= COURT.halfWidth;
}
