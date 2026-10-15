// What the user can know about the opponent (ADR-017): the scouting line naming their habit, their cards at this
// match's decisions, the tell, and the record of earlier meetings.
import type { QuickState } from '../quick/ladder.ts';
import type { QuickMatch } from '../quick/match.ts';
import { personaOf } from '../quick/persona.ts';
import type { Habit, OpponentRead, RivalRecord } from '../quick/types.ts';
import { en } from '../text/en.ts';
import type { Messages } from '../text/types.ts';

/** "Kim goes for broke on match points": the habit, said about the player by surname. */
export const habitLine = (name: string, habit: Habit, t: Messages = en): string => t.habit(name, habit);

/** "Head to head 2-1 to you; they attacked 3 of 4 big points": the record and their most played big-point card. */
export function rivalLine(r: RivalRecord, t: Messages = en): string {
  if (!r.seen.length) return t.rival(r, null);
  const counts = (['attack', 'defend', 'counter'] as const).map((c) => [c, r.seen.filter((x) => x === c).length] as const);
  const [card, n] = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return t.rival(r, { card, n, of: r.seen.length });
}

export function opponentRead(m: QuickMatch, t: Messages = en): OpponentRead {
  const opp = m.recipe.config.players[1];
  const tell = m.pending?.tell;
  return {
    scouting: t.scouting(opp.name, t.style[opp.style], m.persona.habit),
    history: m.decisions.map((d) => ({ score: `${d.score[0]}-${d.score[1]}`, card: d.ai })),
    tell: tell ? t.tells[tell.card][tell.index]! : null,
    rival: m.rival ? rivalLine(m.rival, t) : null,
  };
}

/** The habit and rival lines for an opponent on the ladder home, before the match. */
export function opponentScouting(s: QuickState, id: string, t: Messages = en): { habit: string; rival: string | null } {
  const p = s.world.players.find((x) => x.id === id)!;
  const rival = s.rivals[id];
  return { habit: habitLine(p.name, personaOf(s.seed, id).habit, t), rival: rival ? rivalLine(rival, t) : null };
}
