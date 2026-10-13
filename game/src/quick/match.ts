// One quick match (ADR-017): one tiebreak. Points without cards play on the user's game plan; at big points the
// match stops for a card. The AI has chosen first (its tell can show), then the user picks. The recipe replays it.
import {
  advance, createConfig, isOver, liveStatus, startMatch, type Card, type LiveMatch, type MatchConfig, type MatchRecipe, type PointCards,
  type PointEvent, type Surface,
} from '@tennis/engine';
import { USER_ID } from '../player/create.ts';
import { profileOf } from '../player/profile.ts';
import { stream, streamSeed } from '../rng.ts';
import { QUICK, TIEBREAK_RULES } from '../tuning.ts';
import { aiDecision } from './ai.ts';
import { nextOpponent, type QuickState } from './ladder.ts';
import { isDecisionPoint } from './moments.ts';
import { personaOf } from './persona.ts';
import { planTactic } from './plan.ts';
import type { AiDecision, DecisionContext, DecisionRecord, GamePlan, Persona, RivalRecord } from './types.ts';

export interface QuickMatchInit {
  config: MatchConfig;
  seed: number;
  matchNo: number;
  opponent: string;
  plan: GamePlan;
  persona: Persona;
  rival: RivalRecord | null;
}

export interface QuickMatch extends Omit<QuickMatchInit, 'config'> {
  readonly recipe: MatchRecipe & { cards: (PointCards | null)[] };
  readonly live: LiveMatch;
  readonly decisions: DecisionRecord[];
  /** The AI's choice at the decision point about to be played; null between decision points. */
  pending: AiDecision | null;
}

export function createQuickMatch({ config, ...init }: QuickMatchInit): QuickMatch {
  return { ...init, recipe: { config, seed: init.seed, tacticChanges: [], cards: [] }, live: startMatch(config, init.seed), decisions: [], pending: null };
}

/** The next match on the ladder: the next opponent, this match's surface, the user's plan. */
export function startQuick(s: QuickState, plan: GamePlan = 'balanced'): QuickMatch {
  const opponent = nextOpponent(s);
  const [me, opp] = [s.world.players.find((p) => p.id === USER_ID)!, s.world.players.find((p) => p.id === opponent)!];
  const config = createConfig([profileOf(me), profileOf(opp)], {
    surface: QUICK.surfaces[s.matchNo % QUICK.surfaces.length] as Surface,
    rules: { ...TIEBREAK_RULES },
    tactics: [planTactic(plan), planTactic('balanced')],
    firstServer: streamSeed(s.seed, 'quick-toss', s.matchNo) % 2 === 0 ? 'A' : 'B',
  });
  const seed = streamSeed(s.seed, 'quick', s.matchNo);
  return createQuickMatch({ config, seed, matchNo: s.matchNo, opponent, plan, persona: personaOf(s.seed, opponent), rival: s.rivals[opponent] ?? null });
}

export const matchOver = (m: QuickMatch): boolean => isOver(m.live);

/** Whether the user serves or returns the next point. */
export const userRole = (m: QuickMatch): 'serve' | 'return' => (liveStatus(m.live).server === 'A' ? 'serve' : 'return');

const pointsOf = (m: QuickMatch) => m.live.events.filter((e): e is PointEvent => e.type === 'point');

/** What the AI weighs at the next point, from its side. */
export function decisionContext(m: QuickMatch): DecisionContext {
  const st = liveStatus(m.live);
  const last = pointsOf(m).at(-1);
  return {
    style: m.recipe.config.players[1].style, persona: m.persona, role: st.server === 'B' ? 'serve' : 'return',
    score: [st.score.points[1], st.score.points[0]], tags: st.nextTags,
    lastPointWinner: last ? (last.winner === 'B' ? 'ai' : 'user') : null,
    decisions: m.decisions.map((d) => ({ own: d.ai, user: d.user, won: d.winner === 'B' })),
    rival: m.rival, fatigue: st.fatigue.B, rng: stream(m.seed, 'card', st.pointsPlayed),
  };
}

/** Plays points without cards up to the next decision point (where the AI then picks) or the end. */
export function autoPlay(m: QuickMatch): PointEvent[] {
  const played: PointEvent[] = [];
  while (!m.pending && !isOver(m.live)) {
    const st = liveStatus(m.live);
    if (isDecisionPoint(st.score, st.nextTags)) {
      m.pending = aiDecision(decisionContext(m));
      break;
    }
    advance(m.live, 'point');
    m.recipe.cards.push(null);
    played.push(pointsOf(m).at(-1)!);
  }
  return played;
}

/** Plays the pending decision point with the user's card. */
export function decide(m: QuickMatch, card: Card): { cards: PointCards; point: PointEvent } {
  if (!m.pending) throw new Error('No decision is pending');
  const before = liveStatus(m.live).score.points;
  const cards = { A: card, B: m.pending.card };
  advance(m.live, 'point', { cards });
  m.recipe.cards.push(cards);
  const point = pointsOf(m).at(-1)!;
  m.decisions.push({ point: point.index, score: [before[0], before[1]], user: card, ai: cards.B, winner: point.winner });
  m.pending = null;
  return { cards, point };
}
