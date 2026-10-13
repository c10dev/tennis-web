import { describe, expect, it } from 'vitest';
import { cardEntropy, ladderPace, median, skillLadder, winRate } from '../src/quick/balance.ts';
import { exploitBot, fixedBot, randomBot, readerBot } from '../src/quick/bots.ts';
import { QUICK_TARGETS as T } from '../src/quick/targets.ts';

// Guards the M5 short-loop targets with 600 matches per bot and 10 ladders (the CLI runs 2,000 and 30):
// `npm run test:quick`. Ranges are slightly wider than the CLI's for the smaller samples.
const N = 600;
const within = (v: number, t: { min: number; max: number }, slack: number) => {
  expect(v).toBeGreaterThanOrEqual(t.min - slack);
  expect(v).toBeLessThanOrEqual(t.max + slack);
};

describe('quick-match balance (ADR-016)', () => {
  const random = winRate(randomBot, N, 7);

  it('lasts about 35 points and under 90 seconds on screen', () => {
    within(median(random.points), T.medianPoints, 0);
    within(median(random.seconds), T.medianSeconds, 3);
  });

  it('has no card to rely on: one-card habits lose to the AI, and no card beats any card', () => {
    for (const c of ['attack', 'defend', 'counter'] as const) {
      within(winRate(fixedBot(c), N, 7).win, T.fixedCardWin, 0.03);
      within(winRate(fixedBot(c), N, 7, randomBot).win, T.cardVsRandom, 0.03);
    }
  });

  it('rewards reading the AI, which stays varied', () => {
    within(winRate(exploitBot, N, 7).win, T.exploitWin, 0.03);
    within(cardEntropy(random.aiCards), T.aiEntropy, 0);
  });

  it('lets better players win more often', () => {
    const w = skillLadder(200, 7);
    for (let i = 1; i < w.length; i++) expect(w[i]!).toBeGreaterThan(w[i - 1]!);
  });

  it('climbs the ladder at the intended pace', () => within(ladderPace(readerBot, 10, 30, 7), T.ladderClimb30, 3));
});
