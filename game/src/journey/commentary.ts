// Text commentary for a big match (ADR-032): the match played again from its recipe, told as one line per game, a
// sentence for every point that decides a game, set or match, and the numbers at the end. Korean only (TD-080).
import { formatPoints, replayMatch, type MatchRecipe, type PlayerId, type PointEvent, type ShotEvent } from '@tennis/engine';
import { withJosa } from '../text/ko.ts';

export type LineKind = 'title' | 'set' | 'game' | 'break' | 'key' | 'set-end' | 'end' | 'stats';

export interface Line {
  kind: LineKind;
  text: string;
  /** The user's side (player A) won this game, set, point or match; absent for neutral lines. */
  ours?: boolean;
}

const STROKE: Record<string, string> = { serve: '서브', lob: '로브', drop: '드롭샷', volley: '발리', overhead: '스매시' };

function stroke(s: ShotEvent): string {
  if (s.shot === 'drive' || s.shot === 'return' || s.shot === 'approach') return s.wing === 'backhand' ? '백핸드' : '포핸드';
  if (s.shot === 'slice') return `${s.wing === 'backhand' ? '백핸드' : '포핸드'} 슬라이스`;
  return STROKE[s.shot] ?? s.shot;
}

/** "박서브의 포핸드 위너" — how a point ended, by name. */
export function ending(p: PointEvent, names: Record<PlayerId, string>): string {
  const last = p.shots.at(-1);
  const server = names[p.server];
  if (p.endedBy === 'ace') return `${server}의 에이스`;
  if (p.endedBy === 'double_fault') return `${server}의 더블 폴트`;
  if (!last) return `${names[p.winner]}의 득점`;
  const by = names[last.hitter];
  if (p.endedBy === 'winner') return `${by}의 ${stroke(last)} 위너`;
  return `${by}의 ${stroke(last)} ${p.endedBy === 'forced_error' ? '범실(압박)' : '범실'}`;
}

const LABEL: Partial<Record<string, string>> = { match_point: '매치 포인트', set_point: '세트 포인트', break_point: '브레이크 포인트' };

export function commentary(recipe: MatchRecipe, heading: string): Line[] {
  const result = replayMatch(recipe);
  const names: Record<PlayerId, string> = { A: recipe.config.players[0].name, B: recipe.config.players[1].name };
  const lines: Line[] = [{ kind: 'title', text: heading }, { kind: 'set', text: '1세트' }];
  const events = result.events;
  let set = 1;
  events.forEach((e, i) => {
    if (e.type === 'point') {
      const tag = (['match_point', 'set_point', 'break_point'] as const).find((t) => e.tags.includes(t));
      if (!tag) return;
      const holder = tag === 'break_point' ? other(e.server) : e.scoreAfter.sets.length > e.scoreBefore.sets.length ? e.winner : other(e.winner);
      const rally = e.rallyLength > 3 ? ` (${e.rallyLength}구 랠리)` : '';
      const at = `${e.scoreBefore.games[0]}-${e.scoreBefore.games[1]} ${formatPoints(e.scoreBefore)}`;
      const saved = e.winner !== holder ? ' · 세이브' : '';
      lines.push({ kind: 'key', text: `${names[holder]}의 ${LABEL[tag]} (${at}) — ${ending(e, names)}${saved}${rally}`, ours: e.winner === 'A' });
    } else if (e.type === 'game_end') {
      const [a, b] = e.score.games;
      const games = a + b === 0 && e.score.sets.length ? e.score.sets.at(-1)! : [a, b];
      const tiebreak = Math.max(games[0]!, games[1]!) === 7 && Math.min(games[0]!, games[1]!) === 6;
      const text = tiebreak ? `타이브레이크는 ${names[e.winner]}의 것 · ${games[0]}-${games[1]}`
        : e.isBreak ? `브레이크! ${withJosa(names[e.winner], '이', '가')} 상대 서브 게임을 가져왔다 · ${games[0]}-${games[1]}`
          : `${names[e.winner]} 서비스 게임 · ${games[0]}-${games[1]}`;
      lines.push({ kind: e.isBreak ? 'break' : 'game', text, ours: e.winner === 'A' });
    } else if (e.type === 'set_end') {
      const [a, b] = e.score.sets.at(-1)!;
      lines.push({ kind: 'set-end', text: `${set}세트는 ${names[e.winner]}의 것 · ${a}-${b}`, ours: e.winner === 'A' });
      set++;
      if (events[i + 1]?.type !== 'match_end') lines.push({ kind: 'set', text: `${set}세트` });
    } else if (e.type === 'match_end') {
      const score = e.score.sets.map(([a, b]) => `${a}-${b}`).join(' ');
      lines.push({ kind: 'end', text: `경기 종료! ${names[e.winner]} 승리 · ${score}`, ours: e.winner === 'A' });
      const st = e.stats;
      lines.push({ kind: 'stats', text: `에이스 ${st.aces[0]}-${st.aces[1]} · 더블 폴트 ${st.doubleFaults[0]}-${st.doubleFaults[1]} · 위너 ${st.winners[0]}-${st.winners[1]} · 범실 ${st.unforcedErrors[0]}-${st.unforcedErrors[1]} · 브레이크 ${st.breakPoints[0]} / ${st.breakPoints[1]}` });
    }
  });
  return lines;
}

const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');
