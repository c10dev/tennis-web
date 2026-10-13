// How AI players plan a week: enter by tier and ranking unless tired or hurt; otherwise train the weakest area.
import { DEFAULT_TACTIC, type Tactic } from '@tennis/engine';
import { tournamentInWeek } from '../calendar/schedule.ts';
import { canPlay, type Focus } from '../player/week.ts';
import { stream } from '../rng.ts';
import { AI, FOCUS_RATINGS } from '../tuning.ts';
import type { CareerPlayer } from '../types.ts';
import { currentRanking, playerById, type SeasonState, type UserChoice } from './state.ts';

export function aiChoice(s: SeasonState, id: string): UserChoice {
  const p = playerById(s, id);
  if (!canPlay(p)) return { kind: 'rest' };
  const t = tournamentInWeek(s.week);
  if (t && p.fatigue <= AI.enterUpTo) {
    const rank = currentRanking(s).indexOf(id) + 1;
    const playedLastWeek = s.lastPlayed[id] === s.week - 1;
    const skip = (t.tier === 'challenger' && rank <= AI.skipChallengersTop) || (t.tier === 't250' && rank <= AI.skip250AfterPlayingTop && playedLastWeek);
    const picks = stream(s.seed, 'plan', s.week, id).next() < AI.enterChance[t.tier];
    if (!skip && picks) return { kind: 'enter' };
  }
  if (p.fatigue > AI.restAt) return { kind: 'rest' };
  return { kind: 'train', focus: weakestFocus(p), intensity: 'normal' };
}

function weakestFocus(p: CareerPlayer): Focus {
  const avg = (f: Focus) => FOCUS_RATINGS[f].reduce((a, k) => a + p.attributes[k], 0) / FOCUS_RATINGS[f].length;
  return (Object.keys(FOCUS_RATINGS) as Focus[]).reduce((best, f) => (avg(f) < avg(best) ? f : best));
}

export const aiTactic = (p: CareerPlayer): Tactic => ({ ...DEFAULT_TACTIC, aggression: AI.aggression[p.style] });
