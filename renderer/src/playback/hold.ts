// The decision hold (ADR-024 S2, TD-061): while the cards are up the next point has not been played, so the players
// are not on the timeline. Both wait where it will start, in a ready stance, and the opponent's body shows the tell.
// A function of the hold's own seconds, so the idle and any sway keep moving while match time stands still.
import type { Card, PlayerId, Vec2 } from '@tennis/engine';
import { HOLD_CARDS, HOLD_RELEASE_SEC, HOLD_RELEASE_SPEED, READY_STANCE, HOLD_STANCES, RIG_MOTION, type StanceCue } from '../tuning/index.ts';
import { smoothstep } from '../math.ts';
import { blendPose } from './blend.ts';
import { readySpot } from './movement.ts';
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

const NEUTRAL: StanceCue = { depth: 0, lean: 0, drop: 0, sway: 0, swayHz: 0, step: 0, stepHz: 0, bounce: 0, bounceHz: 0, spread: 0, turn: 0 };

/** A tell over what its card's tells share (HOLD_CARDS, B3): numbers add, the tell's own arms replace the card's. */
function withCard(card: Card, tell: StanceCue): StanceCue {
  const base = HOLD_CARDS[card];
  const add = (k: 'depth' | 'lean' | 'drop' | 'spread' | 'turn') => tell[k] + (base[k] ?? 0);
  const arms = (k: 'hand' | 'dir' | 'free') => tell[k] ?? base[k];
  const out: StanceCue = { ...tell, depth: add('depth'), lean: add('lean'), drop: add('drop'), spread: add('spread'), turn: add('turn') };
  for (const k of ['hand', 'dir', 'free'] as const) { const v = arms(k); if (v) out[k] = v; }
  return out;
}
const v3 = (a: readonly [number, number, number]) => ({ x: a[0], y: a[1], z: a[2] });

/** Where each player starts the next point (movement `readySpot`, where the walk after the last point ends), facing
 *  the net. */
export function readyPositions(timeline: Timeline): Record<PlayerId, Spot> {
  const spot = (id: PlayerId): Spot => {
    const pos = readySpot(timeline, id);
    return { pos, facing: { x: 0, y: -Math.sign(pos.y) } };
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
    pelvis: R.pelvis + 0.6 * cue.turn, turn: R.turn + cue.turn, lean: R.lean + cue.lean, drop: R.drop + cue.drop,
    hand: v3(cue.hand ?? R.hand), dir: v3(cue.dir ?? R.dir), free: v3(cue.free ?? R.free),
  };
  const f = spot.facing;
  // Player frame (x to the left, z forward) to court: left of the facing direction is (−f.y, f.x).
  const foot = ([x, z]: readonly [number, number]): Vec2 => ({ x: pos.x - f.y * x + f.x * z, y: pos.y + f.x * x + f.y * z });
  const still = !cue.sway && !cue.step && !cue.bounce;
  const stroke: StrokePose = {
    kind: 'forehand', weight: 1, keys, contact: { x: 0, y: 0, z: 0 }, contactWeight: 0, hop: 0, keyTimes: [], lunge: { x: 0, y: 0, z: 0 },
    plant: { l: foot([R.feet[0][0] + cue.spread / 2, R.feet[0][1]]), r: foot([R.feet[1][0] - cue.spread / 2, R.feet[1][1]]), weight: still ? 1 : 0 },
  };
  return {
    pos, facing: f, speed, velocity, swing: null, reaction: 'none', reactionWeight: 0,
    gait: { phase: 2 * Math.PI * RIG_MOTION.gaitHz * t, amount: Math.min(1, speed / RIG_MOTION.fullRunSpeed) },
    crouch: Math.min(1, Math.max(0, keys.drop / 0.2)),
    splitStep: cue.bounce * Math.abs(Math.sin(Math.PI * cue.bounceHz * t)),
    toss: 0, t, stroke,
    distance: swayDistance(cue.sway, cue.swayHz, t) + swayDistance(cue.step, cue.stepHz, t),
    reactionT: -1,
    // The stance's own arms, so a blend from or to a carried racket (A2) moves between keys, not clips.
    carry: { weight: 1, keys, free: 1, spread: 0 },
  };
}

/** Both players' poses `since` seconds into the hold; `tell` shows a tell on one of them. */
export function heldPlayers(timeline: Timeline, tell: TellStance | null, since: number): Record<PlayerId, PlayerPose> {
  const spots = readyPositions(timeline);
  const cue = (id: PlayerId) => (tell && tell.player === id ? withCard(tell.card, HOLD_STANCES[tell.card][tell.index] ?? NEUTRAL) : NEUTRAL);
  return { A: stancePose(spots.A, cue('A'), since), B: stancePose(spots.B, cue('B'), since) };
}

/** Seconds the release takes: HOLD_RELEASE_SEC, or as long as a walk (HOLD_RELEASE_SPEED) needs to cover the
 *  furthest a player is from where the point starts (a tell that creeps in, plus the engine's spread, ADR-030). */
export function releaseSeconds(from: Record<PlayerId, PlayerPose>, to: Record<PlayerId, PlayerPose>): number {
  const far = Math.max(...(['A', 'B'] as const).map((id) => Math.hypot(to[id].pos.x - from[id].pos.x, to[id].pos.y - from[id].pos.y)));
  return Math.max(HOLD_RELEASE_SEC, far / HOLD_RELEASE_SPEED);
}

/** The players `since` seconds after the hold (ADR-030): position, facing and body ease from the held poses to the
 *  timeline's over `releaseSeconds` (`blendPose`, TD-078), so the stance hands the body back instead of swapping it.
 *  `ref`: the timeline's poses as the release began. */
export function releasedPlayers(from: Record<PlayerId, PlayerPose>, to: Record<PlayerId, PlayerPose>, since: number, ref?: Record<PlayerId, PlayerPose>): Record<PlayerId, PlayerPose> {
  const u = since / releaseSeconds(from, to);
  if (u >= 1) return to;
  const k = smoothstep(Math.max(0, u));
  return { A: blendPose(from.A, to.A, k, ref?.A), B: blendPose(from.B, to.B, k, ref?.B) };
}

/** `u` (0–1) of the way from the poses last drawn before the hold (the walk into it) to the held ones (TD-078); `ref`
 *  as in `releasedPlayers`. */
export function enteredPlayers(from: Record<PlayerId, PlayerPose>, held: Record<PlayerId, PlayerPose>, u: number, ref?: Record<PlayerId, PlayerPose>): Record<PlayerId, PlayerPose> {
  if (u >= 1) return held;
  const k = smoothstep(Math.max(0, u));
  return { A: blendPose(from.A, held.A, k, ref?.A), B: blendPose(from.B, held.B, k, ref?.B) };
}
