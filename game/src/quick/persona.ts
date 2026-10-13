// Opponent personas (ADR-017): one signature habit each, fixed by the ladder seed and the player, never stored.
// A habit is a rule a user can learn from the scouting line: in this situation, this card.
import type { Card } from '@tennis/engine';
import { pick, stream } from '../rng.ts';
import { QUICK_PERSONA } from '../tuning.ts';
import type { DecisionContext, Habit, Persona } from './types.ts';

export const HABITS: readonly Habit[] = ['big_point_attack', 'counter_after_loss', 'repeat_winner', 'defend_when_ahead', 'copy_user', 'safe_on_match_point'];

export const personaOf = (seed: number, playerId: string): Persona => ({
  habit: pick(stream(seed, 'persona', playerId), HABITS),
  tellAccuracy: QUICK_PERSONA.tellAccuracy,
});

/** What a habit looks at: the AI's side of the decision, nothing random. */
export type HabitSituation = Pick<DecisionContext, 'persona' | 'score' | 'tags' | 'lastPointWinner' | 'decisions'>;

/** The card the opponent's habit calls for at this decision, or null when the habit does not apply. */
export function habitCard({ persona, score: [ai, user], tags, lastPointWinner, decisions }: HabitSituation): Card | null {
  const last = decisions.at(-1);
  const matchPoint = tags.includes('match_point');
  switch (persona.habit) {
    case 'big_point_attack': return matchPoint ? 'attack' : null;
    case 'counter_after_loss': return lastPointWinner === 'user' ? 'counter' : null;
    case 'repeat_winner': return last?.won ? last.own : null;
    case 'defend_when_ahead': return ai > user ? 'defend' : null;
    case 'copy_user': return last ? last.user : null;
    case 'safe_on_match_point': return matchPoint && user > ai ? 'defend' : null;
  }
}
