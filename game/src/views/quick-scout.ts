// What the user can know about the opponent (ADR-017): the scouting line naming their habit, their cards at this
// match's decisions, the tell, and the record of earlier meetings.
import type { Card, PlayStyle } from '@tennis/engine';
import type { QuickState } from '../quick/ladder.ts';
import { BEATEN_BY } from '../quick/cards.ts';
import { decisionContext, type QuickMatch } from '../quick/match.ts';
import { habitCard, personaFor } from '../quick/persona.ts';
import { QUICK_PERSONA } from '../tuning.ts';
import type { Habit, OpponentRead, RivalRecord } from '../quick/types.ts';
import { STYLE_LABEL } from './format.ts';

const HABIT_PHRASE: Record<Habit, string> = {
  big_point_attack: 'goes for broke on match points',
  counter_after_loss: 'counters after losing a point',
  repeat_card: 'sticks with their card from the last big point',
  defend_unless_behind: 'plays safe unless behind',
  copy_user: 'copies your card from the last big point',
  beat_user_last: 'plays what beats your last big-point card',
};

const PLAYED: Record<Card, string> = { attack: 'attacked', defend: 'defended', counter: 'countered' };

/** "Kim goes for broke on match points": the habit, said about the player by surname. */
export const habitLine = (name: string, habit: Habit): string => `${name.split(' ').at(-1)} ${HABIT_PHRASE[habit]}`;

const scoutingLine = (name: string, style: PlayStyle, habit: Habit) => `${name} · ${STYLE_LABEL[style]} — ${habitLine(name, habit)}`;

/** "Head to head 2-1 to you; they attacked 3 of 4 big points". */
export function rivalLine(r: RivalRecord): string {
  const h2h = `Head to head ${r.wins}-${r.losses}${r.wins === r.losses ? '' : r.wins > r.losses ? ' to you' : ' to them'}`;
  if (!r.seen.length) return h2h;
  const counts = (['attack', 'defend', 'counter'] as const).map((c) => [c, r.seen.filter((x) => x === c).length] as const);
  const [card, n] = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return `${h2h}; they ${PLAYED[card]} ${n} of ${r.seen.length} big point${r.seen.length === 1 ? '' : 's'}`;
}

export function opponentRead(m: QuickMatch): OpponentRead {
  const opp = m.recipe.config.players[1];
  return {
    scouting: scoutingLine(opp.name, opp.style, m.persona.habit),
    history: m.decisions.map((d) => ({ score: `${d.score[0]}-${d.score[1]}`, card: d.ai })),
    tell: m.pending?.tell?.text ?? null,
    rival: m.rival ? rivalLine(m.rival) : null,
  };
}

/** The habit and rival lines for an opponent on the ladder home, before the match. */
export function opponentScouting(s: QuickState, id: string): { habit: string; rival: string | null } {
  const p = s.world.players.find((x) => x.id === id)!;
  const rival = s.rivals[id];
  return { habit: habitLine(p.name, personaFor(s, id).habit), rival: rival ? rivalLine(rival) : null };
}

const LABEL: Record<Card, string> = { attack: 'Attack', defend: 'Defend', counter: 'Counter' };

/** The guided first match (proposal P4): at each decision against the ladder's first opponent in match one, what their
 *  habit predicts and what beats it, or that the tell is the read; null in every other match. `s` is the ladder before
 *  the match. */
export function guideLine(s: QuickState, m: QuickMatch): string | null {
  if (s.matchNo !== 0 || m.opponent !== s.tutor) return null;
  const card = habitCard(decisionContext(m));
  if (!card) return `Their habit doesn't apply here: trust the tell, right ${Math.round(QUICK_PERSONA.tellAccuracy * 10)} times in 10.`;
  return `Their habit says ${card} here: ${LABEL[BEATEN_BY[card]]} beats ${LABEL[card]}.`;
}
