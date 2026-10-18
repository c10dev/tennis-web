// New careers (ADR-032/033): a world with a year already played so rankings mean something, then the humans: a
// room's 18-year-olds on equal terms, or one 14-year-old for the long career.
import { ovr, createPro, type Group } from './ratings.ts';
import { ranked as rankedIds, total } from './ranking.ts';
import { humanId, view, type Member } from './room.ts';
import { advanceRoom } from './swing.ts';
import { START } from './tuning.ts';
import type { CareerStats, Hand, HumanState, JourneyState, JPlayer, RoomState, Stage } from './types.ts';
import { createRoster } from './world.ts';

export const USER = 'user';

export interface Start {
  seed: number;
  player: JPlayer;
  hand: Hand;
  focus: Group[];
  /** 'pro' for a room's 18-year-olds (with room starting points); 'junior' for the long career from 14. */
  stage?: 'junior' | 'pro';
}

/** The world after its warm-up year, with nobody in it yet. */
function emptyRoom(seed: number, names: readonly string[]): RoomState {
  const roster = createRoster(seed, names[0] ?? '', names);
  let r: RoomState = { seed, year: 0, swing: 0, pros: roster.pros, juniors: roster.juniors, nextId: roster.nextId, points: {}, juniorPoints: {}, humans: {}, order: [] };
  for (let i = 0; i < 4; i++) r = advanceRoom(r, {}).room;
  return { ...r, year: 1, swing: 0 };
}

function human(player: JPlayer, hand: Hand, focus: Group[], stage: Stage): HumanState {
  return {
    user: { player, hand, stage, morale: START.morale, reputation: START.reputation, money: START.money, focus, team: {}, injury: 0, college: 0, peak: ovr(player) },
    stats: emptyStats(), reports: [], seen: [], pending: [], notes: [],
  };
}

/** A room's starting points: those of the pro at `START.rank` (or the last one with points), spread over the four swings. */
function startingPoints(r: RoomState): number[] {
  const list = rankedIds(r.pros, r.points);
  const each = Math.max(1, Math.round(total(r.points[list[Math.min(list.length, START.rank) - 1]!]) / 4));
  return [each, each, each, each];
}

/** A season room: every member an 18-year-old pro at the same OVR and points, shaped by their talents. */
export function createRoom(seed: number, members: readonly Member[]): RoomState {
  const r = emptyRoom(seed, members.map((m) => m.name));
  const pts = startingPoints(r);
  const humans: Record<string, HumanState> = {};
  const points = { ...r.points };
  for (const m of members) {
    const id = humanId(m.id);
    const player = { ...createPro({ name: m.name, nation: m.nation, style: m.style }, m.talents), id };
    humans[id] = human(player, m.hand, m.focus, 'pro');
    points[id] = [...pts];
  }
  return { ...r, humans, order: members.map((m) => humanId(m.id)), points };
}

/** One player's career: a 14-year-old junior by default, or a room-style pro with `stage: 'pro'`. */
export function newJourney({ seed, player, hand, focus, stage = 'junior' }: Start): JourneyState {
  const r = emptyRoom(seed, [player.name]);
  const me: JPlayer = { ...player, id: USER };
  const points = stage === 'pro' ? { ...r.points, [USER]: startingPoints(r) } : r.points;
  return view({ ...r, points, humans: { [USER]: human(me, hand, focus, stage) }, order: [USER] }, USER);
}

export const emptyStats = (): CareerStats => ({
  wins: 0, losses: 0, titles: 0, majors: 0, juniorTitles: 0, juniorMajors: 0, majorWins: [], finals: 0,
  bestRank: null, bestJuniorRank: null, swingsAtOne: 0, prize: 0, h2h: {},
});
