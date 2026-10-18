// A new career (ADR-032): the chosen candidate, a world with a year already played so rankings mean something.
import { ovr, type Group } from './ratings.ts';
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
}

export function newJourney({ seed, player, hand, focus }: Start): JourneyState {
  const roster = createRoster(seed, player.name);
  const me: JPlayer = { ...player, id: USER };
  const user = {
    player: me, hand, stage: 'junior' as const, morale: START.morale, reputation: START.reputation, money: START.money,
    focus, coach: 0 as const, sponsor: null, injury: 0, college: 0, peak: ovr(me),
  };
  let s: JourneyState = {
    seed, year: 0, swing: 0, user, pros: roster.pros, juniors: roster.juniors, nextId: roster.nextId,
    points: {}, juniorPoints: {}, stats: emptyStats(), reports: [], seen: [], pending: [], notes: [],
  };
  // A year of the tour without the user, so the first ranking list is earned, not drawn.
  for (let i = 0; i < 4; i++) s = advanceSwing(s, { load: 'normal', focus }, false).state;
  return { ...s, year: 1, swing: 0, user, stats: emptyStats(), reports: [], seen: [] };
}

export const emptyStats = (): CareerStats => ({
  wins: 0, losses: 0, titles: 0, majors: 0, juniorTitles: 0, juniorMajors: 0, majorWins: [], finals: 0,
  bestRank: null, bestJuniorRank: null, swingsAtOne: 0, prize: 0, h2h: {},
});
