import { describe, expect, it } from 'vitest';
import type { Card } from '@tennis/engine';
import { BEATEN_BY, CARDS, cardOdds, decisionOdds } from '../src/quick/ai.ts';
import { habitCard } from '../src/quick/persona.ts';
import { rivalStance, switchCard } from '../src/quick/rivals.ts';
import { QUICK_PERSONA } from '../src/tuning.ts';
import type { DecisionContext, Habit, RivalRecord } from '../src/quick/types.ts';

// TD-034 (ADR-025): a rival adapts to the head to head, readably: wary when the user leads, confident when it does.
type Situation = Omit<DecisionContext, 'rng'>;
const base: Situation = {
  style: 'baseliner', persona: { habit: 'counter_after_loss', tellAccuracy: QUICK_PERSONA.tellAccuracy }, role: 'serve', score: [5, 5], tags: ['tiebreak'],
  lastPointWinner: 'user', decisions: [], rival: null, fatigue: 0,
};
const rival = (wins: number, losses: number, seen: Card[] = []): RivalRecord => ({ met: wins + losses, wins, losses, seen });
const at = (habit: Habit, over: Partial<Situation> = {}): Situation => ({ ...base, ...over, persona: { ...base.persona, habit } });
const R = QUICK_PERSONA.rival;

/** The user's matchup edge (won minus lost) when playing `mine` against the AI's odds. */
const edge = (odds: readonly number[], mine: Card) => odds[CARDS.indexOf(BEATEN_BY[mine])] === undefined
  ? 0 : CARDS.reduce((a, c, i) => a + (BEATEN_BY[c] === mine ? odds[i]! : BEATEN_BY[mine] === c ? -odds[i]! : 0), 0);

describe('rivalStance', () => {
  it('is wary when the user leads the head to head, confident when the rival does, and nothing when level or new', () => {
    expect(rivalStance(null)).toBeNull();
    expect(rivalStance(rival(1, 1))).toBeNull();
    expect(rivalStance(rival(2, 1))).toBe('wary');
    expect(rivalStance(rival(0, 1))).toBe('confident');
  });

  it('switches to the card that beats the user\'s answer to the habit', () => {
    for (const c of CARDS) expect(switchCard(c)).toBe(BEATEN_BY[BEATEN_BY[c]]);
  });
});

describe('decisionOdds against a rival', () => {
  it('plays the habit less and the switch card instead when the user leads, still the habit most of all', () => {
    const odds = decisionOdds(at('counter_after_loss', { rival: rival(2, 0) }));
    expect(odds[CARDS.indexOf('counter')]).toBeCloseTo(R.wary.habitShare, 9);
    expect(odds[CARDS.indexOf(switchCard('counter'))]).toBeCloseTo(R.wary.switchShare, 9);
    expect(odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(Math.max(...odds)).toBe(odds[CARDS.indexOf('counter')]);
  });

  it('leaves no card invincible: answering the habit still pays most, but less than at a first meeting', () => {
    const first = decisionOdds(at('counter_after_loss'));
    const wary = decisionOdds(at('counter_after_loss', { rival: rival(3, 1) }));
    const answer = BEATEN_BY.counter;
    for (const c of CARDS) if (c !== answer) expect(edge(wary, answer)).toBeGreaterThan(edge(wary, c));
    expect(edge(wary, answer)).toBeLessThan(edge(first, answer));
    expect(edge(wary, answer)).toBeGreaterThan(0.2);
  });

  it('sticks to the habit more when it leads the head to head', () => {
    const odds = decisionOdds(at('counter_after_loss', { rival: rival(0, 2) }));
    expect(odds[CARDS.indexOf('counter')]).toBeCloseTo(R.confident.habitShare, 9);
    expect(R.confident.habitShare).toBeGreaterThan(QUICK_PERSONA.habitShare);
  });

  it('is unchanged by the record when the habit does not apply', () => {
    const ctx = at('counter_after_loss', { lastPointWinner: 'ai', rival: rival(3, 0) });
    expect(decisionOdds(ctx)).toEqual(cardOdds({ style: ctx.style, role: ctx.role, history: [], fatigue: 0 }));
  });
});

describe('a rematch\'s first decision', () => {
  it('lets a card-repeating rival repeat its last big-point card from the last meeting', () => {
    expect(habitCard(at('repeat_card', { rival: rival(1, 0, ['attack', 'defend']) }))).toBe('defend');
    expect(habitCard(at('repeat_card', { rival: rival(1, 0, []) }))).toBeNull();
    const own = { own: 'counter' as Card, user: 'attack' as Card, won: true };
    expect(habitCard(at('repeat_card', { decisions: [own], rival: rival(1, 0, ['defend']) }))).toBe('counter');
  });
});
