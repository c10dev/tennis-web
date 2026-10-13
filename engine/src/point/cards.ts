// What the cards played on a point do (ADR-015). Pure numbers: no random draws, so a point without cards is
// exactly the point it always was.
import type { PlayerRuntime } from '../player/condition.ts';
import { AVG, CARDS } from '../tuning.ts';
import type { Card, PlayerId, PointCards } from '../types.ts';

export interface CardEffect {
  /** Risk appetite for this point (replaces the tactic's). */
  aggression: number;
  /** Server only: logit shifts on in % and aces, and added serve quality. */
  serveIn: number;
  serveAce: number;
  serveQuality: number;
  /** Multiplier on this player's rally error chance, and logit shift on their winners. */
  errorMul: number;
  winnerShift: number;
}

const BEATS: Record<Card, Card> = { attack: 'defend', defend: 'counter', counter: 'attack' };

/** +1 if `mine` beats `theirs`, −1 if it loses, 0 for the same card. */
export const matchup = (mine: Card, theirs: Card): number => (BEATS[mine] === theirs ? 1 : BEATS[theirs] === mine ? -1 : 0);

/** How much a player gets out of a card: their ratings behind it, their style, and (for attack) their legs. */
export function cardStrength(card: Card, p: PlayerRuntime): number {
  const keys = CARDS.stats[card];
  const mean = keys.reduce((a, k) => a + p.n[k], 0) / keys.length;
  const style = (CARDS.style as Partial<Record<string, Partial<Record<Card, number>>>>)[p.style]?.[card] ?? 1;
  const tired = card === 'attack' ? 1 - CARDS.fatigueAttack * p.fatigue : 1;
  return Math.max(CARDS.minStrength, (1 + CARDS.statWeight * (mean - AVG)) * style * tired);
}

export function cardEffects(cards: PointCards, server: PlayerId, players: Record<PlayerId, PlayerRuntime>): Record<PlayerId, CardEffect> {
  const returner: PlayerId = server === 'A' ? 'B' : 'A';
  const effect = (id: PlayerId): CardEffect => {
    const card = cards[id];
    const other = cards[id === 'A' ? 'B' : 'A'];
    const k = cardStrength(card, players[id]);
    const role = CARDS.roles[id === server ? 'serve' : 'return'][card];
    const e = matchup(card, other) * k;
    return {
      aggression: role.aggression,
      serveIn: role.serveIn * k,
      serveAce: role.serveAce * k + (id === server ? CARDS.edgeAce * e : 0),
      serveQuality: role.serveQuality * k + CARDS.edgeQuality * e,
      errorMul: role.errorMul * Math.exp(-CARDS.edgeError * e),
      winnerShift: role.winnerShift * k + CARDS.edgeWinner * e,
    };
  };
  const out = { [server]: effect(server), [returner]: effect(returner) } as Record<PlayerId, CardEffect>;
  // A returner who read the serve takes quality off it.
  out[server].serveQuality -= out[returner].serveQuality;
  return out;
}
