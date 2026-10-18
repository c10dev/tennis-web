// A new career (ADR-032): the chosen candidate, a world with a year already played so rankings mean something.
import { ovr, type Group } from './ratings.ts';
import { order, total } from './ranking.ts';
import { advanceSwing } from './swing.ts';
import { START } from './tuning.ts';
import type { CareerStats, Hand, JourneyState, JPlayer } from './types.ts';
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

export function newJourney({ seed, player, hand, focus, stage = 'junior' }: Start): JourneyState {
  const roster = createRoster(seed, player.name);
  const me: JPlayer = { ...player, id: USER };
  const user = {
    player: me, hand, stage, morale: START.morale, reputation: START.reputation, money: START.money,
    focus, team: {}, injury: 0, college: 0, peak: ovr(me),
  };
  let s: JourneyState = {
    seed, year: 0, swing: 0, user, pros: roster.pros, juniors: roster.juniors, nextId: roster.nextId,
    points: {}, juniorPoints: {}, stats: emptyStats(), reports: [], seen: [], pending: [], notes: [],
  };
  // A year of the tour without the user, so the first ranking list is earned, not drawn.
  for (let i = 0; i < 4; i++) s = advanceSwing(s, { events: [], focus }, false).state;
  const points = stage === 'pro' ? { ...s.points, [USER]: startingPoints(s) } : s.points;
  return { ...s, year: 1, swing: 0, user, points, stats: emptyStats(), reports: [], seen: [] };
}

/** A room's starting points: those of the pro at `START.rank`, spread evenly over the four swings. */
function startingPoints(s: JourneyState): number[] {
  const ranked = order(s.pros, s.points);
  const at = ranked[Math.min(ranked.length, START.rank) - 1]!;
  const each = Math.round(total(s.points[at]) / 4);
  return [each, each, each, each];
}

export const emptyStats = (): CareerStats => ({
  wins: 0, losses: 0, titles: 0, majors: 0, juniorTitles: 0, juniorMajors: 0, majorWins: [], finals: 0,
  bestRank: null, bestJuniorRank: null, swingsAtOne: 0, prize: 0, h2h: {},
});
