import { describe, expect, it } from 'vitest';
import { winRate } from '../src/quick/balance.ts';
import { fixedBot, randomBot, scoutBot, tellBot } from '../src/quick/bots.ts';
import { readStats } from '../src/quick/read-balance.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';
import { QUICK_PERSONA } from '../src/tuning.ts';

// Guards the opponent-read targets of ADR-017 with 600 matches per bot: `npm run test:quick`.
const T = QUICK_TARGETS.read;
const N = 600;
const within = (v: number, t: { min: number; max: number }, slack: number) => {
  expect(v).toBeGreaterThanOrEqual(t.min - slack);
  expect(v).toBeLessThanOrEqual(t.max + slack);
};

describe('quick-match opponent balance (ADR-017)', () => {
  it('gives random cards an even chance and no card to rely on, across every opponent', () => {
    within(winRate(randomBot, N, 7).win, T.randomWin, 0.03);
    for (const c of ['attack', 'defend', 'counter'] as const) within(winRate(fixedBot(c), N, 7).win, T.fixedCardWin, 0.03);
  });

  it('has each opponent play its habit card 60-75% of the time when its habit applies, in most decisions', () => {
    const s = readStats(randomBot, N, 7);
    within(s.habitShare, T.habitShare, 0.02);
    expect(s.habitApplies).toBeGreaterThan(0.5);
    for (const c of Object.values(s.byHabit)) expect(c.applies / c.decisions).toBeGreaterThan(0.3);
  });

  // The match-win targets also need the match flow's decisions and matchup weight (ADR-017); until both land, the
  // decision-level edge is what this workstream guarantees: knowing the habit or following the tells wins matchups.
  it('rewards knowing an opponent\'s habit: it wins clearly more matchups than it loses, and more matches', () => {
    const s = readStats(scoutBot, N, 7);
    expect(s.beat - s.beaten).toBeGreaterThan(0.35);
    expect(s.win).toBeGreaterThan(0.53);
  });

  it('rewards following the tells: right tellAccuracy of the time, so most matchups won', () => {
    const s = readStats(tellBot, N, 7);
    expect(s.beat).toBeGreaterThan(QUICK_PERSONA.tellAccuracy - 0.03);
    expect(s.win).toBeGreaterThan(T.tellWin.min - 0.03);
  });

  it('keeps the scouting line a better read than the tells (ADR-025)', () => {
    within(readStats(scoutBot, N, 7).win - readStats(tellBot, N, 7).win, T.scoutOverTells, 0.01);
  });
});
