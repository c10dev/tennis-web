// What the user can know about the opponent (ADR-017): the scouting line naming their habit, their cards at this
// match's decisions, the tell, and the record of earlier meetings.
import type { QuickState } from '../quick/ladder.ts';
import type { QuickMatch } from '../quick/match.ts';
import { fixedHabitCard, personaOf } from '../quick/persona.ts';
import { planTip } from '../quick/plan.ts';
import { rivalStance, switchCard } from '../quick/rivals.ts';
import type { Habit, OpponentRead, RivalRecord } from '../quick/types.ts';
import { en } from '../text/en.ts';
import type { Messages, RivalLine } from '../text/types.ts';

/** "Kim goes for broke on match points": the habit, said about the player by surname. */
export const habitLine = (name: string, habit: Habit, t: Messages = en): string => t.habit(name, habit);

/** "Head to head 2-1 to you; wary of your read: may switch to Attack …; last big point: Defend": the record, how the
 *  rival has adapted to it (ADR-025) and its last big-point card (a card-repeater's habit card at a rematch's start). */
export function rivalLine(r: RivalRecord, habit: Habit, t: Messages = en): string {
  const stance = rivalStance(r);
  const card = fixedHabitCard(habit);
  const line: RivalLine = stance === 'wary' ? { kind: 'wary', card: card && switchCard(card) } : stance ? { kind: stance } : null;
  return t.rival(r, line, r.seen.at(-1) ?? null);
}

export function opponentRead(m: QuickMatch, t: Messages = en): OpponentRead {
  const opp = m.recipe.config.players[1];
  const tell = m.pending?.tell;
  return {
    scouting: t.scouting(opp.name, t.style[opp.style], m.persona.habit),
    history: m.decisions.map((d) => ({ score: `${d.score[0]}-${d.score[1]}`, card: d.ai })),
    tell: tell ? t.tells[tell.card][tell.index]! : null,
    rival: m.rival ? rivalLine(m.rival, m.persona.habit, t) : null,
  };
}

/** The habit, rival and plan-tip lines for an opponent on the ladder home, before the match. */
export function opponentScouting(s: QuickState, id: string, t: Messages = en): { habit: string; rival: string | null; plan: string | null } {
  const p = s.world.players.find((x) => x.id === id)!;
  const rival = s.rivals[id];
  const tip = planTip(p.style);
  return { habit: habitLine(p.name, personaOf(s.seed, id).habit, t), rival: rival ? rivalLine(rival, personaOf(s.seed, id).habit, t) : null, plan: tip ? t.planTip(tip, p.style) : null };
}
