import { describe, expect, it } from 'vitest';
import { winRate } from '../src/quick/balance.ts';
import { fixedBot, randomBot } from '../src/quick/bots.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';

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

  it.todo('rewards knowing an opponent\'s habit with 65%+ wins (read workstream)');
  it.todo('rewards following the tells with 57%+ wins (read workstream)');
  it.todo('has each opponent play its habit card 60-75% of the time when its habit applies (read workstream)');
});
