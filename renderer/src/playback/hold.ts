// The decision hold (ADR-024 S2, TD-061): while the cards are up the next point has not been played, so the players
// are not on the timeline. Both wait where it will start, in a ready stance, and the opponent's body shows the tell.
// A function of the hold's own seconds, so the idle and any sway keep moving while match time stands still.
import { COURT, type Card, type PlayerId, type Vec2 } from '@tennis/engine';
import { READY_SPOTS, READY_STANCE, HOLD_STANCES, RIG_MOTION, type StanceCue } from '../tuning/index.ts';
import { positionAt } from './movement.ts';
import type { PlayerPose } from './pose.ts';
import type { Effectors, StrokePose } from './stroke.ts';
import type { Timeline } from './timeline.ts';

/** The tell to show, on whom: `index` is the tell text's (game `Tell.index`). */
export interface TellStance {
  player: PlayerId;
  card: Card;
  index: number;
}

interface Spot { pos: Vec2; facing: Vec2 }

const NEUTRAL: StanceCue = { depth: 0, lean: 0, drop: 0, sway: 0, swayHz: 0, step: 0, stepHz: 0, bounce: 0, bounceHz: 0 };
const v3 = (a: readonly [number, number, number]) => ({ x: a[0], y: a[1], z: a[2] });

/** Where each player starts the next point: the server at the centre mark, the receiver wide and deep, each on the
 *  end they will play it from, in the deuce or advantage court; facing the net. */
export function readyPositions(timeline: Timeline): Record<PlayerId, Spot> {
  const seg = timeline.segments.at(-1)!;
  const after = seg.point.scoreAfter;
  const deuce = (after.points[0] + after.points[1]) % 2 === 0;
  const spot = (id: PlayerId): Spot => {
    const was = Math.sign(positionAt(timeline, id, seg.end).y) || (id === 'A' ? -1 : 1);
    const side = seg.changesEnds ? -was : was;
    const s = id === after.server ? READY_SPOTS.server : READY_SPOTS.receiver;
    // The deuce court is the right of a player facing the net: −x on the near end (side −1), +x on the far end.
    const right = side === -1 ? 1 : -1;
    return { pos: { x: (deuce ? right : -right) * s.x, y: side * (COURT.halfLength + s.back) }, facing: { x: 0, y: -side } };
  };
  return { A: spot('A'), B: spot('B') };
}

/** Total distance a point `amp · sin(2π hz t)` has moved by time t (exact: its total variation). */
function swayDistance(amp: number, hz: number, t: number): number {
  if (!amp || !hz) return 0;
  const theta = 2 * Math.PI * hz * t;
  const half = Math.floor(theta / Math.PI);
  const phi = theta - half * Math.PI;
  return amp * (2 * half + (phi <= Math.PI / 2 ? Math.sin(phi) : 2 - Math.sin(phi)));
}

function stancePose(spot: Spot, cue: StanceCue, t: number): PlayerPose {
  const away = -spot.facing.y;
  const w = (hz: number) => 2 * Math.PI * hz;
  const sx = cue.sway * Math.sin(w(cue.swayHz) * t);
  const sy = -cue.step * Math.sin(w(cue.stepHz) * t);
  const pos = { x: spot.pos.x + sx, y: spot.pos.y + away * cue.depth + away * sy };
  const velocity = { x: cue.sway * w(cue.swayHz) * Math.cos(w(cue.swayHz) * t), y: -away * cue.step * w(cue.stepHz) * Math.cos(w(cue.stepHz) * t) };
  const speed = Math.hypot(velocity.x, velocity.y);
  const R = READY_STANCE;
  const keys: Effectors = {
    pelvis: R.pelvis, turn: R.turn, lean: R.lean + cue.lean, drop: R.drop + cue.drop,
    hand: v3(cue.hand ?? R.hand), dir: v3(cue.dir ?? R.dir), free: v3(cue.free ?? R.free),
  };
  const f = spot.facing;
  // Player frame (x to the left, z forward) to court: left of the facing direction is (−f.y, f.x).
  const foot = ([x, z]: readonly [number, number]): Vec2 => ({ x: pos.x - f.y * x + f.x * z, y: pos.y + f.x * x + f.y * z });
  const still = !cue.sway && !cue.step && !cue.bounce;
  const stroke: StrokePose = {
    kind: 'forehand', weight: 1, keys, contact: { x: 0, y: 0, z: 0 }, contactWeight: 0, hop: 0, keyTimes: [],
    plant: { l: foot(R.feet[0]), r: foot(R.feet[1]), weight: still ? 1 : 0 },
  };
  return {
    pos, facing: f, speed, velocity, swing: null, reaction: 'none', reactionWeight: 0,
    gait: { phase: 2 * Math.PI * RIG_MOTION.gaitHz * t, amount: Math.min(1, speed / RIG_MOTION.fullRunSpeed) },
    crouch: Math.min(1, Math.max(0, keys.drop / 0.2)),
    splitStep: cue.bounce * Math.abs(Math.sin(Math.PI * cue.bounceHz * t)),
    toss: 0, t, stroke,
    distance: swayDistance(cue.sway, cue.swayHz, t) + swayDistance(cue.step, cue.stepHz, t),
    reactionT: -1,
  };
}

/** Both players' poses `since` seconds into the hold; `tell` shows a tell on one of them. */
export function heldPlayers(timeline: Timeline, tell: TellStance | null, since: number): Record<PlayerId, PlayerPose> {
  const spots = readyPositions(timeline);
  const cue = (id: PlayerId) => (tell && tell.player === id ? HOLD_STANCES[tell.card][tell.index] ?? NEUTRAL : NEUTRAL);
  return { A: stancePose(spots.A, cue('A'), since), B: stancePose(spots.B, cue('B'), since) };
}
