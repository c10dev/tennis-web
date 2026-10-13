import { describe, expect, it } from 'vitest';
import { createRng, type Card } from '@tennis/engine';
import { aiCard, cardEntropy, type CardContext } from '../src/quick/ai.ts';

const CARDS: Card[] = ['attack', 'defend', 'counter'];
const share = (cards: Card[], c: Card) => cards.filter((x) => x === c).length / cards.length;
const sample = (ctx: Omit<CardContext, 'rng'>, n = 4000, seed = 1) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => aiCard({ ...ctx, rng }));
};

describe('aiCard', () => {
  it('is the same card for the same random stream and situation', () => {
    const ctx = { style: 'baseliner' as const, role: 'serve' as const, history: ['attack', 'defend'] as Card[], fatigue: 0 };
    expect(sample(ctx, 50, 9)).toEqual(sample(ctx, 50, 9));
  });

  it('leans on its style: a big server attacks with the serve, a counter-puncher counters on the return', () => {
    const big = sample({ style: 'big_server', role: 'serve', history: [], fatigue: 0 });
    expect(share(big, 'attack')).toBeGreaterThan(0.4);
    const cp = sample({ style: 'counter_puncher', role: 'return', history: [], fatigue: 0 });
    expect(share(cp, 'counter')).toBeGreaterThan(0.4);
  });

  // Adaptation is deliberately mild (QUICK_AI.adapt): strong enough to punish a one-card habit, weak enough that the
  // AI's own tells stay readable (ADR-016).
  it('reads a habit: after a run of attacks it counters clearly more often', () => {
    const fresh = sample({ style: 'baseliner', role: 'return', history: [], fatigue: 0 });
    const read = sample({ style: 'baseliner', role: 'return', history: ['attack', 'attack', 'attack', 'attack', 'attack', 'attack'], fatigue: 0 });
    expect(share(read, 'counter')).toBeGreaterThan(share(fresh, 'counter') + 0.08);
  });

  it('stays hard to predict: at least 1.3 bits of entropy whatever it has seen', () => {
    for (const style of ['big_server', 'baseliner', 'counter_puncher', 'all_court'] as const) {
      for (const role of ['serve', 'return'] as const) {
        expect(cardEntropy(sample({ style, role, history: [], fatigue: 0 }))).toBeGreaterThanOrEqual(1.3);
        expect(cardEntropy(sample({ style, role, history: Array(6).fill('defend') as Card[], fatigue: 0 }))).toBeGreaterThanOrEqual(1.3);
      }
    }
  });

  it('tends to repeat its own last card: a tell a user can learn', () => {
    const after = sample({ style: 'all_court', role: 'serve', history: [], fatigue: 0, lastOwn: 'defend' });
    const fresh = sample({ style: 'all_court', role: 'serve', history: [], fatigue: 0 });
    expect(share(after, 'defend')).toBeGreaterThan(share(fresh, 'defend') + 0.15);
  });

  it('attacks less when tired', () => {
    const fresh = sample({ style: 'big_server', role: 'serve', history: [], fatigue: 0 });
    const tired = sample({ style: 'big_server', role: 'serve', history: [], fatigue: 0.9 });
    expect(share(tired, 'attack')).toBeLessThan(share(fresh, 'attack') - 0.05);
  });
});

describe('cardEntropy', () => {
  it('is log2(3) for an even mix and 0 for one card', () => {
    expect(cardEntropy([...CARDS, ...CARDS])).toBeCloseTo(Math.log2(3), 9);
    expect(cardEntropy(['attack', 'attack'])).toBe(0);
  });
});
