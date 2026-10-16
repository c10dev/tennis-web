import { describe, expect, it } from 'vitest';
import { fixedBot, randomBot, scoutBot } from '../src/quick/bots.ts';
import { readStats, rematch } from '../src/quick/read-balance.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';

// Guards the rival targets of ADR-025 (TD-034) with 600 rematches per bot: the rival adapts, nothing becomes invincible.
const T = QUICK_TARGETS.rematch;
const N = 600;

describe('rematches against an adapting rival (ADR-025)', () => {
  for (const lead of ['user', 'rival'] as const) {
    it(`still rewards the scouting read when the ${lead} leads the head to head, and lets no card dominate`, () => {
      const scout = readStats(scoutBot, N, 7, rematch(lead)).win;
      const random = readStats(randomBot, N, 7, rematch(lead)).win;
      expect(scout - random).toBeGreaterThanOrEqual(T.scoutOverRandom.min - 0.02);
      for (const c of ['attack', 'defend', 'counter'] as const) expect(readStats(fixedBot(c), N, 7, rematch(lead)).win).toBeLessThanOrEqual(T.fixedCardWin.max + 0.03);
    });
  }

  it('makes the rematch harder to read after the user won it, easier after the rival did', () => {
    const lead = readStats(scoutBot, N, 7, rematch('user')).win;
    const first = readStats(scoutBot, N, 7).win;
    const trail = readStats(scoutBot, N, 7, rematch('rival')).win;
    expect(lead).toBeLessThan(first);
    expect(trail).toBeGreaterThan(first);
  });
});
