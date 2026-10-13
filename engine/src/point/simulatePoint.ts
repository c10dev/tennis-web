// One point as a sequence of shots (GDD §5.1): serve(s), return, then the rally until an error or a winner.
import { returnSkill, strokeSkill, type PlayerRuntime } from '../player/condition.ts';
import { chance, type Rng } from '../rng/mulberry32.ts';
import { CARDS, GEOMETRY, RALLY } from '../tuning.ts';
import type { Outcome, PlayerId, PointCards, ShotEvent, ShotType, Surface, Vec2, Wing } from '../types.ts';
import { cardEffects, type CardEffect } from './cards.ts';
import { chase } from './chase.ts';
import type { Side } from './court.ts';
import * as geo from './geometry.ts';
import { errorProbability, shotQualityMean, winnerProbability } from './outcome.ts';
import { chooseServeTarget, drawServe, serveOdds, type ServeTarget } from './serve.ts';
import { chooseShot, type TargetSide } from './shotSelection.ts';
import { clamp01, logit, shifted, sigmoid } from './prob.ts';
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
  /** Cards played on this point, if any (ADR-015). */
  cards?: PointCards;
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

  const push = (hitter: PlayerId, shot: ShotType, landing: geo.Landing, speed: number, spin: number, outcome: Outcome, wing?: Wing, ball?: Vec2) => {
    const from = geo.contactPoint(rng, pos[hitter], sideOf(hitter), shot === 'serve', ball);
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

  // Cards (ADR-015) set each player's risk appetite for the point and tilt serve and rally odds; without cards
  // nothing below changes by even a rounding error.
  const eff: Record<PlayerId, CardEffect> | null = input.cards ? cardEffects(input.cards, server, input.players) : null;
  const players: Record<PlayerId, PlayerRuntime> = eff
    ? {
      A: { ...input.players.A, tactic: { ...input.players.A.tactic, aggression: eff.A.aggression } },
      B: { ...input.players.B, tactic: { ...input.players.B.tactic, aggression: eff.B.aggression } },
    }
    : input.players;
  const srv = players[server];
  const ret = players[returner];
  const odds = (n: 1 | 2, target: ServeTarget) => {
    const o = serveOdds(srv, ret, n, target, surface, pressure);
    if (!eff) return o;
    const e = eff[server];
    const share = n === 1 ? 1 : CARDS.secondServeShare;
    return { pIn: shifted(o.pIn, e.serveIn * share), pAce: shifted(o.pAce, e.serveAce), quality: clamp01(o.quality + e.serveQuality) };
  };
  let serveNumber: 1 | 2 = 1;
  for (;;) {
    const target = chooseServeTarget(rng, srv.tactic);
    const second = serveNumber === 2;
    const result = drawServe(rng, odds(serveNumber, target));
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
      const me = players[hitter];
      const opp = players[other(hitter)];
      const shot: ShotType = n === 0 ? 'return' : 'drive';
      const incomingShot = shots.at(-1)!;
      const met = chase(rng, {
        bounce, from: incomingShot.from, speedKmh: incomingShot.speedKmh, surface, side: sideOf(hitter), player: pos[hitter],
        sinceKey: incomingShot.flightSec, wing, returning: n === 0,
      });
      pos[hitter] = met.pos;
      t += met.bounceToContact;
      const choice = chooseShot(rng, me, opp, incoming);
      const skill = shot === 'return' ? returnSkill(me, wing) : strokeSkill(me, wing);
      const base = errorProbability({ skill, risk: choice.risk, incoming, fatigue: me.fatigue, pressure, composure: me.n.composure, surface });
      const pError = eff ? Math.min(0.97, base * eff[hitter].errorMul) : base;
      const speedSpin = (r: Risk) => [geo.speedKmh(rng, shot, skill, surface, r), geo.spinRpm(rng, shot, r)] as const;
      if (chance(rng, pError)) {
        const outcome: Outcome = incoming > RALLY.forcedThreshold ? 'forced_error' : 'unforced_error';
        const [speed, spin] = speedSpin(choice.risk);
        const flight = push(hitter, shot, geo.rallyLanding(rng, sideOf(other(hitter)), choice.target, false), speed, spin, outcome, wing, met.contact);
        return finish(other(hitter), outcome, serveNumber, flight);
      }
      const quality = clamp01(shotQualityMean(skill, choice.risk, incoming, surface) + RALLY.qualitySpread * (2 * rng.next() - 1));
      const pWinner = winnerProbability(quality, opp, surface, choice.risk);
      const isWinner = chance(rng, eff ? sigmoid(logit(pWinner) + eff[hitter].winnerShift) : pWinner);
      const [speed, spin] = speedSpin(choice.risk);
      const landing = geo.rallyLanding(rng, sideOf(other(hitter)), choice.target, true);
      const flight = push(hitter, shot, landing, speed, spin, isWinner ? 'winner' : 'in', wing, met.contact);
      if (isWinner) return finish(hitter, 'winner', serveNumber, flight);
      pos[hitter] = geo.recoverPosition(rng, pos[hitter], sideOf(hitter), GEOMETRY.maxRunSpeed * (flight + GEOMETRY.minContactSec));
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

