// The quick-match card AI (ADR-016): readable but not predictable. It plays its style's habits, leans towards the
// card that beats the user's recent habit, and never plays one card more than QUICK_AI.maxShare of the time.
import type { Card, PlayStyle, Rng } from '@tennis/engine';
import { QUICK_AI } from '../tuning.ts';
import type { AiDecision, DecisionContext } from './types.ts';

export const CARDS: readonly Card[] = ['attack', 'defend', 'counter'];
/** The card that beats each card: attack > defend > counter > attack. */
export const BEATEN_BY: Record<Card, Card> = { attack: 'counter', defend: 'attack', counter: 'defend' };

export interface CardContext {
  style: PlayStyle;
  role: 'serve' | 'return';
  /** The user's cards so far in the matching role (user returning when the AI serves), oldest first. */
  history: readonly Card[];
  fatigue: number;
  /** The AI's own previous card in this match, if any. */
  lastOwn?: Card;
}

/** The AI's chances of playing attack, defend and counter in this situation. */
export function cardOdds(ctx: CardContext): [number, number, number] {
  const [a, d, c] = QUICK_AI.base[ctx.style][ctx.role];
  let p = [a * (1 - QUICK_AI.fatigueAttack * ctx.fatigue), d, c];
  const total = p.reduce((x, y) => x + y, 0);
  p = p.map((x) => x / total);
  if (ctx.lastOwn) {
    const again = CARDS.indexOf(ctx.lastOwn);
    p = p.map((x, i) => (1 - QUICK_AI.sticky) * x + (i === again ? QUICK_AI.sticky : 0));
  }
  const recent = ctx.history.slice(-QUICK_AI.window);
  if (recent.length > 0) {
    const counts = CARDS.map((card) => recent.filter((x) => x === card).length / recent.length);
    const top = counts.indexOf(Math.max(...counts));
    const habit = Math.max(0, (counts[top]! - QUICK_AI.habitFloor) / (1 - QUICK_AI.habitFloor));
    const q = QUICK_AI.adapt * habit;
    const answer = CARDS.indexOf(BEATEN_BY[CARDS[top]!]);
    p = p.map((x, i) => (1 - q) * x + (i === answer ? q : 0));
  }
  const max = Math.max(...p);
  if (max > QUICK_AI.maxShare) {
    const keep = (QUICK_AI.maxShare - 1 / 3) / (max - 1 / 3);
    p = p.map((x) => keep * x + (1 - keep) / 3);
  }
  return p as [number, number, number];
}

/** One draw from the AI's odds. */
export function aiCard(ctx: CardContext & { rng: Rng }): Card {
  const p = cardOdds(ctx);
  let r = ctx.rng.next();
  for (let i = 0; i < 3; i++) {
    r -= p[i]!;
    if (r < 0) return CARDS[i]!;
  }
  return CARDS[2]!;
}

/** Shannon entropy of a sequence of cards, in bits. */
export function cardEntropy(cards: readonly Card[]): number {
  const h = CARDS.reduce((sum, card) => {
    const p = cards.filter((x) => x === card).length / cards.length;
    return p > 0 ? sum - p * Math.log2(p) : sum;
  }, 0);
  return h + 0;
}

/** The AI's chances at a decision point (ADR-017). For now: the style mix, read against the user's decision cards. */
export function decisionOdds(ctx: Omit<DecisionContext, 'rng'>): [number, number, number] {
  const last = ctx.decisions.at(-1);
  return cardOdds({ style: ctx.style, role: ctx.role, history: ctx.decisions.map((d) => d.user), fatigue: ctx.fatigue, ...(last ? { lastOwn: last.own } : {}) });
}

/** The AI's card at a decision point and the tell the user sees. For now: no tell. */
export function aiDecision(ctx: DecisionContext): AiDecision {
  const p = decisionOdds(ctx);
  let r = ctx.rng.next();
  for (let i = 0; i < 3; i++) {
    r -= p[i]!;
    if (r < 0) return { card: CARDS[i]!, tell: null };
  }
  return { card: CARDS[2]!, tell: null };
}
