// A whole season without a user at the controls: the batch report and tests play the user with `choose`.
import { quickRecipe, pendingUserMatch, playRound } from './round.ts';
import type { SeasonState, UserChoice } from './state.ts';
import { beginWeek, closeWeek, seasonOver } from './week.ts';

export function simulateSeason(start: SeasonState, choose: (s: SeasonState) => UserChoice): SeasonState {
  let s = start;
  while (!seasonOver(s)) {
    s = beginWeek(s, choose(s));
    while (s.tournament && !s.tournament.done) {
      const pending = pendingUserMatch(s);
      s = playRound(s, pending ? quickRecipe(pending) : undefined);
    }
    s = closeWeek(s);
  }
  return s;
}
