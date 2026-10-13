import { describe, expect, it } from 'vitest';
import { createRng, type Card } from '@tennis/engine';
import { aiDecision, CARDS, cardOdds, decisionOdds } from '../src/quick/ai.ts';
import { habitBot, scoutBot, type BotView } from '../src/quick/bots.ts';
import { habitCard, HABITS, personaOf } from '../src/quick/persona.ts';
import { TELL_TEXTS } from '../src/quick/tells.ts';
import { QUICK_PERSONA } from '../src/tuning.ts';
import type { DecisionContext, Habit } from '../src/quick/types.ts';

type Situation = Omit<DecisionContext, 'rng'>;
const base: Situation = {
  style: 'baseliner', persona: { habit: 'big_point_attack', tellAccuracy: QUICK_PERSONA.tellAccuracy }, role: 'serve', score: [5, 5], tags: ['tiebreak'],
  lastPointWinner: null, decisions: [], rival: null, fatigue: 0,
};
const at = (habit: Habit, over: Partial<Situation> = {}): Situation => ({ ...base, ...over, persona: { ...base.persona, habit } });
const won = { own: 'counter' as Card, user: 'attack' as Card, won: true };
const lost = { own: 'attack' as Card, user: 'counter' as Card, won: false };

describe('habitCard', () => {
  it('names the habit card only in the habit\'s situation', () => {
    expect(habitCard(at('big_point_attack', { score: [6, 5], tags: ['match_point', 'tiebreak'] }))).toBe('attack');
    expect(habitCard(at('big_point_attack', { score: [5, 6], tags: ['match_point', 'tiebreak'] }))).toBe('attack');
    expect(habitCard(at('big_point_attack'))).toBeNull();

    expect(habitCard(at('counter_after_loss', { lastPointWinner: 'user' }))).toBe('counter');
    expect(habitCard(at('counter_after_loss', { lastPointWinner: 'ai' }))).toBeNull();

    expect(habitCard(at('repeat_card', { decisions: [lost, won] }))).toBe('counter');
    expect(habitCard(at('repeat_card', { decisions: [won, lost] }))).toBe('attack');
    expect(habitCard(at('repeat_card'))).toBeNull();

    expect(habitCard(at('defend_unless_behind', { score: [6, 5] }))).toBe('defend');
    expect(habitCard(at('defend_unless_behind', { score: [5, 5] }))).toBe('defend');
    expect(habitCard(at('defend_unless_behind', { score: [5, 6] }))).toBeNull();

    expect(habitCard(at('copy_user', { decisions: [lost] }))).toBe('counter');
    expect(habitCard(at('copy_user'))).toBeNull();

    expect(habitCard(at('beat_user_last', { decisions: [lost] }))).toBe('defend');
    expect(habitCard(at('beat_user_last', { decisions: [won] }))).toBe('counter');
    expect(habitCard(at('beat_user_last'))).toBeNull();
  });

  it('gives every opponent one habit, the same for the same seed and player, and uses every habit', () => {
    expect(personaOf(1, 'p7')).toEqual(personaOf(1, 'p7'));
    const seen = new Set(Array.from({ length: 200 }, (_, i) => personaOf(5, `p${i}`).habit));
    expect([...seen].sort()).toEqual([...HABITS].sort());
  });
});

describe('decisionOdds', () => {
  it('plays the habit card habitShare of the time when the habit applies, the rest in its style\'s proportions', () => {
    const ctx = at('counter_after_loss', { lastPointWinner: 'user' });
    const mix = cardOdds({ style: ctx.style, role: ctx.role, history: [], fatigue: 0 });
    const odds = decisionOdds(ctx);
    expect(odds[2]).toBeCloseTo(QUICK_PERSONA.habitShare, 9);
    expect(odds[0] / odds[1]).toBeCloseTo(mix[0] / mix[1], 9);
    expect(odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('is its style mix when the habit does not apply', () => {
    const ctx = at('counter_after_loss', { lastPointWinner: 'ai' });
    expect(decisionOdds(ctx)).toEqual(cardOdds({ style: ctx.style, role: ctx.role, history: [], fatigue: 0 }));
  });
});

describe('aiDecision and its tell', () => {
  const draw = (ctx: Situation, n: number, seed: number) => {
    const rng = createRng(seed);
    return Array.from({ length: n }, () => aiDecision({ ...ctx, rng }));
  };

  it('is the same decision and tell for the same random stream', () => {
    expect(draw(base, 40, 3)).toEqual(draw(base, 40, 3));
  });

  it('fixes the card before the tell: the tell accuracy never changes the card', () => {
    const sure = draw({ ...base, persona: { ...base.persona, tellAccuracy: 1 } }, 200, 8).map((d) => d.card);
    const vague = draw({ ...base, persona: { ...base.persona, tellAccuracy: 0.3 } }, 200, 8).map((d) => d.card);
    expect(vague).toEqual(sure);
  });

  it('points at the real card about tellAccuracy of the time, with a text that describes the card it points at', () => {
    const ds = draw(base, 6000, 11);
    const right = ds.filter((d) => d.tell!.card === d.card).length / ds.length;
    expect(right).toBeGreaterThan(QUICK_PERSONA.tellAccuracy - 0.03);
    expect(right).toBeLessThan(QUICK_PERSONA.tellAccuracy + 0.03);
    for (const d of ds) expect(TELL_TEXTS[d.tell!.card]).toContain(d.tell!.text);
  });

  it('varies its tells: several short texts per card, all of them shown', () => {
    const ds = draw(base, 3000, 12);
    for (const card of CARDS) {
      expect(TELL_TEXTS[card].length).toBeGreaterThanOrEqual(4);
      expect(new Set(ds.filter((d) => d.tell!.card === card).map((d) => d.tell!.text)).size).toBe(TELL_TEXTS[card].length);
      for (const t of TELL_TEXTS[card]) expect(t.length).toBeLessThan(50);
    }
  });
});

describe('reading bots', () => {
  const view = (ai: Situation, seed = 1): BotView => ({ ai, tell: null, rng: createRng(seed) });

  it('habitBot answers the habit card when the habit applies, and plays any card otherwise', () => {
    expect(habitBot(view(at('counter_after_loss', { lastPointWinner: 'user' })))).toBe('defend');
    expect(habitBot(view(at('copy_user', { decisions: [won] })))).toBe('counter');
    const free = at('copy_user');
    expect(new Set(Array.from({ length: 60 }, (_, i) => habitBot(view(free, i)))).size).toBe(3);
  });

  it('scoutBot also knows the style: outside the habit it answers the style\'s favourite card', () => {
    expect(scoutBot(view(at('copy_user', { style: 'baseliner' })))).toBe('attack');
    expect(scoutBot(view(at('copy_user', { style: 'counter_puncher', role: 'return' })))).toBe('defend');
    expect(scoutBot(view(at('big_point_attack', { tags: ['match_point'] })))).toBe('counter');
  });
});
