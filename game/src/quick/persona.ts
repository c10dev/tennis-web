// Opponent personas (ADR-017): one signature habit each, fixed by the ladder seed and the player, never stored.
// A habit is a rule a user can learn from the scouting line and check on the choose screen (the score, the last
// point, the chips of the last decision): in this situation, this card.
import type { Card } from '@tennis/engine';
import { pick, stream } from '../rng.ts';
import { QUICK_PERSONA } from '../tuning.ts';
import { BEATEN_BY } from './cards.ts';
import type { DecisionContext, Habit, Persona } from './types.ts';

export const HABITS: readonly Habit[] = ['big_point_attack', 'counter_after_loss', 'repeat_card', 'defend_unless_behind', 'copy_user', 'beat_user_last'];

export const personaOf = (seed: number, playerId: string): Persona => ({
  habit: pick(stream(seed, 'persona', playerId), HABITS),
  tellAccuracy: QUICK_PERSONA.tellAccuracy,
});

/** What a habit looks at: the AI's side of the decision, nothing random. */
export type HabitSituation = Pick<DecisionContext, 'persona' | 'score' | 'tags' | 'lastPointWinner' | 'decisions'>;

/** The card the opponent's habit calls for at this decision, or null when the habit does not apply. */
export function habitCard({ persona, score: [ai, user], tags, lastPointWinner, decisions }: HabitSituation): Card | null {
  const last = decisions.at(-1);
  switch (persona.habit) {
    /** Attacks whenever either player is a point from the match. */
    case 'big_point_attack': return tags.includes('match_point') ? 'attack' : null;
    /** Counters after losing the point just played. */
    case 'counter_after_loss': return lastPointWinner === 'user' ? 'counter' : null;
    /** Plays its own card from the last decision point again. */
    case 'repeat_card': return last ? last.own : null;
    /** Defends unless it is behind. */
    case 'defend_unless_behind': return ai >= user ? 'defend' : null;
    /** Plays the user's card from the last decision point. */
    case 'copy_user': return last ? last.user : null;
    /** Plays the card that beats the user's card from the last decision point. */
    case 'beat_user_last': return last ? BEATEN_BY[last.user] : null;
  }
}
