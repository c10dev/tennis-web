// One quick match (ADR-016): Fast4 against the next opponent, a card from the user before every point, the AI's
// card from its seeded stream. The recipe (with every point's cards) replays it exactly.
import { advance, createConfig, isOver, liveStatus, startMatch, type Card, type LiveMatch, type MatchRecipe, type PlayerProfile, type Surface } from '@tennis/engine';
import { USER_ID } from '../player/create.ts';
import { stream, streamSeed } from '../rng.ts';
import { QUICK } from '../tuning.ts';
import type { CareerPlayer } from '../types.ts';
import { aiCard } from './ai.ts';
import { nextOpponent, type QuickState } from './ladder.ts';

export interface QuickMatch {
  readonly matchNo: number;
  readonly opponent: string;
  readonly recipe: MatchRecipe & { cards: NonNullable<MatchRecipe['cards']> };
  readonly live: LiveMatch;
  /** The user's cards by the role they played them in, which is what the AI reads. */
  readonly userCards: Record<'serve' | 'return', Card[]>;
  readonly seed: number;
}

const profile = (p: CareerPlayer): PlayerProfile => ({ name: p.name, style: p.style, attributes: p.attributes });

export function startQuick(s: QuickState): QuickMatch {
  const opponent = nextOpponent(s);
  const [me, opp] = [s.world.players.find((p) => p.id === USER_ID)!, s.world.players.find((p) => p.id === opponent)!];
  const surface = QUICK.surfaces[s.matchNo % QUICK.surfaces.length] as Surface;
  const config = createConfig([profile(me), profile(opp)], {
    surface,
    rules: { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'fast4' },
    firstServer: streamSeed(s.seed, 'quick-toss', s.matchNo) % 2 === 0 ? 'A' : 'B',
  });
  const seed = streamSeed(s.seed, 'quick', s.matchNo);
  return { matchNo: s.matchNo, opponent, recipe: { config, seed, tacticChanges: [], cards: [] }, live: startMatch(config, seed), userCards: { serve: [], return: [] }, seed: s.seed };
}

export const matchOver = (m: QuickMatch): boolean => isOver(m.live);

/** Whether the user serves or returns the next point. */
export const userRole = (m: QuickMatch): 'serve' | 'return' => (liveStatus(m.live).server === 'A' ? 'serve' : 'return');

/** Plays the next point with the user's card; returns both cards. */
export function playPoint(m: QuickMatch, card: Card): { A: Card; B: Card } {
  const status = liveStatus(m.live);
  const role = userRole(m);
  const ai = aiCard({
    style: m.recipe.config.players[1].style, role: role === 'serve' ? 'return' : 'serve', history: m.userCards[role],
    fatigue: status.fatigue.B, rng: stream(m.seed, 'card', m.matchNo, status.pointsPlayed),
  });
  const cards = { A: card, B: ai };
  advance(m.live, 'point', { cards });
  m.recipe.cards.push(cards);
  m.userCards[role].push(card);
  return cards;
}
