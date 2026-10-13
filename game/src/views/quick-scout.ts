// What the user can know about the opponent (ADR-017): the scouting line naming their habit, their cards at this
// match's decisions, the tell, and the record of earlier meetings.
import type { Card, PlayStyle } from '@tennis/engine';
import type { QuickState } from '../quick/ladder.ts';
import type { QuickMatch } from '../quick/match.ts';
import { personaOf } from '../quick/persona.ts';
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
  return { habit: habitLine(p.name, personaOf(s.seed, id).habit), rival: rival ? rivalLine(rival) : null };
}
