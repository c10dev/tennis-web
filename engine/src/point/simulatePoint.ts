// One point as a sequence of shots (GDD §5.1): serve(s), return, then the rally until an error or a winner.
import { returnSkill, strokeSkill, type PlayerRuntime } from '../player/condition.ts';
import { chance, type Rng } from '../rng/mulberry32.ts';
import { RALLY } from '../tuning.ts';
import type { Outcome, PlayerId, ShotEvent, ShotType, Surface, Vec2, Wing } from '../types.ts';
import type { Side } from './court.ts';
import * as geo from './geometry.ts';
import { errorProbability, shotQualityMean, winnerProbability } from './outcome.ts';
import { chooseServeTarget, drawServe, serveOdds, type ServeTarget } from './serve.ts';
import { chooseShot, type TargetSide } from './shotSelection.ts';
import { clamp01 } from './prob.ts';
import type { Risk } from '../tuning.ts';

export interface PointInput {
  server: PlayerId;
  players: Record<PlayerId, PlayerRuntime>;
  surface: Surface;
  /** 0–1, see pressureIndex. */
  pressure: number;
  /** Which end A plays from: the sign of A's y. */
  sideOfA: Side;
  /** Serve to the deuce court (even number of points played in the game). */
  deuceCourt: boolean;
}

export interface PointResult {
  winner: PlayerId;
  serveNumber: 1 | 2;
  /** Shots that went in, the serve included: an ace is 1, a double fault 0 (ADR-004). */
  rallyLength: number;
  endedBy: Outcome;
  shots: ShotEvent[];
  durationSec: number;
  shotsHit: Record<PlayerId, number>;
}

const SECOND_SERVE_GAP = 4;
const BOUNCE_TO_CONTACT = 0.45;
const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');

export function simulatePoint(input: PointInput, rng: Rng): PointResult {
  const { server, surface, pressure, deuceCourt } = input;
  const returner = other(server);
  const sideOf = (p: PlayerId): Side => (p === 'A' ? input.sideOfA : (-input.sideOfA as Side));
  const pos: Record<PlayerId, Vec2> = {
    [server]: geo.servePosition(rng, sideOf(server), deuceCourt),
    [returner]: geo.returnPosition(rng, sideOf(returner), deuceCourt),
  } as Record<PlayerId, Vec2>;
  const shots: ShotEvent[] = [];
  const shotsHit: Record<PlayerId, number> = { A: 0, B: 0 };
  let t = 0;

  const push = (hitter: PlayerId, shot: ShotType, landing: geo.Landing, speed: number, spin: number, outcome: Outcome, wing?: Wing) => {
    const from = geo.contactPoint(rng, pos[hitter], sideOf(hitter), shot === 'serve');
    const flightSec = geo.flightSec(from, landing, speed);
    const event: ShotEvent = {
      type: 'shot', t, hitter, shot, from, flightSec, speedKmh: speed, spinRpm: spin, netClearance: landing.netClearance,
      outcome, hitterPos: { ...pos[hitter] }, receiverPos: { ...pos[other(hitter)] },
    };
    if (wing) event.wing = wing;
    if (landing.bounce) event.bounce = landing.bounce;
    shots.push(event);
    shotsHit[hitter] += 1;
    return flightSec;
  };
  const finish = (winner: PlayerId, endedBy: Outcome, serveNumber: 1 | 2, lastFlight: number): PointResult => ({
    winner, serveNumber, endedBy, shots, shotsHit, durationSec: t + lastFlight + 0.8,
    rallyLength: shots.filter((s) => s.outcome === 'in' || s.outcome === 'winner' || s.outcome === 'ace').length,
  });

  const srv = input.players[server];
  const ret = input.players[returner];
  let serveNumber: 1 | 2 = 1;
  for (;;) {
    const target = chooseServeTarget(rng, srv.tactic);
    const second = serveNumber === 2;
    const result = drawServe(rng, serveOdds(srv, ret, serveNumber, target, surface, pressure));
    const skill = second ? srv.n.secondServe : srv.n.servePower;
    const speed = geo.speedKmh(rng, 'serve', skill, surface, 'neutral', second);
    const spin = geo.spinRpm(rng, 'serve', 'neutral', second);
    const landing = geo.serveLanding(rng, sideOf(returner), deuceCourt, target, result.kind !== 'fault');
    if (result.kind === 'fault') {
      const flight = push(server, 'serve', landing, speed, spin, second ? 'double_fault' : 'fault');
      if (second) return finish(returner, 'double_fault', 2, flight);
      t += SECOND_SERVE_GAP;
      serveNumber = 2;
      continue;
    }
    const flight = push(server, 'serve', landing, speed, spin, result.kind === 'ace' ? 'ace' : 'in');
    if (result.kind === 'ace') return finish(server, 'ace', serveNumber, flight);
    t += flight;
    return rally(landing.bounce!, returnWing(rng, target, deuceCourt), result.quality);
  }

  function rally(firstBounce: Vec2, firstWing: Wing, serveQuality: number): PointResult {
    let incoming = serveQuality;
    let hitter = returner;
    let bounce = firstBounce;
    let wing = firstWing;
    for (let n = 0; n < RALLY.maxShots; n++) {
      const me = input.players[hitter];
      const opp = input.players[other(hitter)];
      const shot: ShotType = n === 0 ? 'return' : 'drive';
      pos[hitter] = geo.chasePosition(rng, bounce, sideOf(hitter));
      t += BOUNCE_TO_CONTACT;
      const choice = chooseShot(rng, me, opp, incoming);
      const skill = shot === 'return' ? returnSkill(me, wing) : strokeSkill(me, wing);
      const pError = errorProbability({ skill, risk: choice.risk, incoming, fatigue: me.fatigue, pressure, composure: me.n.composure, surface });
      const speedSpin = (r: Risk) => [geo.speedKmh(rng, shot, skill, surface, r), geo.spinRpm(rng, shot, r)] as const;
      if (chance(rng, pError)) {
        const outcome: Outcome = incoming > RALLY.forcedThreshold ? 'forced_error' : 'unforced_error';
        const [speed, spin] = speedSpin(choice.risk);
        const flight = push(hitter, shot, geo.rallyLanding(rng, sideOf(other(hitter)), choice.target, false), speed, spin, outcome, wing);
        return finish(other(hitter), outcome, serveNumber, flight);
      }
      const quality = clamp01(shotQualityMean(skill, choice.risk, incoming, surface) + RALLY.qualitySpread * (2 * rng.next() - 1));
      const isWinner = chance(rng, winnerProbability(quality, opp, surface, choice.risk));
      const [speed, spin] = speedSpin(choice.risk);
      const landing = geo.rallyLanding(rng, sideOf(other(hitter)), choice.target, true);
      const flight = push(hitter, shot, landing, speed, spin, isWinner ? 'winner' : 'in', wing);
      if (isWinner) return finish(hitter, 'winner', serveNumber, flight);
      pos[hitter] = geo.recoverPosition(rng, pos[hitter], sideOf(hitter));
      t += flight;
      incoming = quality;
      bounce = landing.bounce!;
      wing = receiverWing(rng, choice.target);
      hitter = other(hitter);
    }
    throw new Error(`Point exceeded ${RALLY.maxShots} shots`);
  }
}

/** The returner's wing for a right-hander: wide on the deuce court is a forehand, the T a backhand. */
function returnWing(rng: Rng, target: ServeTarget, deuce: boolean): Wing {
  if (target === 'body') return rng.next() < 0.5 ? 'forehand' : 'backhand';
  return (target === 'wide') === deuce ? 'forehand' : 'backhand';
}

function receiverWing(rng: Rng, target: TargetSide): Wing {
  if (target === 'middle') return rng.next() < 0.6 ? 'forehand' : 'backhand';
  return target;
}

