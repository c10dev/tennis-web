// What the user can know about the opponent at a decision point (ADR-017). For now: their style and their cards so far.
import type { QuickMatch } from '../quick/match.ts';
import type { OpponentRead } from '../quick/types.ts';
import { STYLE_LABEL } from './format.ts';

export function opponentRead(m: QuickMatch): OpponentRead {
  const opp = m.recipe.config.players[1];
  return {
    scouting: `${opp.name} · ${STYLE_LABEL[opp.style]}`,
    history: m.decisions.map((d) => ({ score: `${d.score[0]}-${d.score[1]}`, card: d.ai })),
    tell: m.pending?.tell?.text ?? null,
    rival: null,
  };
}
