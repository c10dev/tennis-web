// Opponent personas (ADR-017): one signature habit each, fixed by the ladder seed and the player, never stored.
import { pick, stream } from '../rng.ts';
import { QUICK_PERSONA } from '../tuning.ts';
import type { Habit, Persona } from './types.ts';

export const HABITS: readonly Habit[] = ['big_point_attack', 'counter_after_loss', 'repeat_winner', 'defend_when_ahead', 'copy_user', 'safe_on_match_point'];

export const personaOf = (seed: number, playerId: string): Persona => ({
  habit: pick(stream(seed, 'persona', playerId), HABITS),
  tellAccuracy: QUICK_PERSONA.tellAccuracy,
});
