import type { Card, PlayerId } from '@tennis/engine';
import { describe, expect, it } from 'vitest';
import { decisiveMoment, highlightOf } from '../src/quick/highlight.ts';
import { HABITS } from '../src/quick/persona.ts';
import { nextGoal } from '../src/quick/standing.ts';
import type { DecisionRecord } from '../src/quick/types.ts';
import { en } from '../src/text/en.ts';
import { textFor } from '../src/text/index.ts';
import { ko, withJosa } from '../src/text/ko.ts';
import { momentLabel, planChoices } from '../src/views/quick-match.ts';
import { habitLine, opponentRead, rivalLine } from '../src/views/quick-scout.ts';
import { quickResultView } from '../src/views/quick-result.ts';
import { quickHomeView } from '../src/views/quick-home.ts';
import { freshLadder, ladderWithDecision, playLadderMatch, toDecision } from './quick-helpers.ts';

const d = (point: number, score: [number, number], user: Card, ai: Card, winner: PlayerId): DecisionRecord => ({ point, score, user, ai, winner });

/** Every key path of a catalog, with array lengths, so two languages can be compared. */
function shape(x: unknown, path = ''): string[] {
  if (Array.isArray(x)) return [`${path}[${x.length}]`];
  if (x && typeof x === 'object') return Object.entries(x).flatMap(([k, v]) => shape(v, `${path}.${k}`)).sort();
  return [`${path}:${typeof x}`];
}

describe('text catalogs (ADR-022)', () => {
  it('picks the catalog by language', () => {
    expect(textFor('en')).toBe(en);
    expect(textFor('ko')).toBe(ko);
  });

  it('has the same keys, functions and tell counts in Korean as in English', () => {
    expect(shape({ ...ko, lang: '' })).toEqual(shape({ ...en, lang: '' }));
  });

  it('chooses 이/가 and 을/를 by the last syllable', () => {
    expect(withJosa('공격', '이', '가')).toBe('공격이');
    expect(withJosa('수비', '이', '가')).toBe('수비가');
    expect(withJosa('카운터', '을', '를')).toBe('카운터를');
    expect(withJosa('공격', '을', '를')).toBe('공격을');
    expect(withJosa('Kim', '이', '가')).toBe('Kim이(가)');
  });
});

describe('Korean screens', () => {
  it('names the big points', () => {
    expect(momentLabel([6, 4], ['set_point', 'match_point'], ko)).toBe('매치 포인트');
    expect(momentLabel([3, 6], ['set_point', 'match_point'], ko)).toBe('매치 포인트 위기');
    expect(momentLabel([5, 5], [], ko)).toBe('5-5 동점');
    expect(momentLabel([5, 2], [], ko)).toBe('승부처');
  });

  it('names the plans and the habits without particles after the (Latin) name', () => {
    expect(planChoices(ko).map((p) => p.label)).toEqual(['공격적', '균형', '수비적']);
    const lines = HABITS.map((h) => habitLine('Min-jun Kim', h, ko));
    expect(new Set(lines).size).toBe(HABITS.length);
    expect(habitLine('Min-jun Kim', 'big_point_attack', ko)).toBe('Kim — 매치 포인트에서 과감하게 공격해요');
  });

  it('says the head to head', () => {
    expect(rivalLine({ met: 3, wins: 2, losses: 1, seen: ['attack', 'attack', 'defend', 'attack'] }, 'big_point_attack', ko))
      .toBe('상대 전적 2승 1패 · 습관을 읽힌 걸 알아요: 습관 대신 수비로 바꿀 수 있어요 · 지난 승부처: 공격');
    expect(rivalLine({ met: 2, wins: 1, losses: 1, seen: [] }, 'big_point_attack', ko)).toBe('상대 전적 1승 1패');
  });

  it('names the decisive choice with the right particles', () => {
    expect(decisiveMoment({ won: false, decisions: [d(10, [5, 5], 'counter', 'attack', 'B')] }, ko)!.line).toBe('5-5: 내 카운터가 상대 공격을 꺾었지만, 포인트는 상대가 가져갔어요');
    expect(decisiveMoment({ won: true, decisions: [d(10, [6, 6], 'defend', 'counter', 'A')] }, ko)!.line).toBe('6-6: 내 수비가 상대 카운터를 꺾었어요');
    expect(decisiveMoment({ won: true, decisions: [d(10, [5, 5], 'attack', 'counter', 'A')] }, ko)!.line).toBe('5-5: 상대 카운터가 내 공격을 꺾었지만, 포인트는 내가 가져갔어요');
    expect(decisiveMoment({ won: false, decisions: [d(10, [5, 5], 'defend', 'defend', 'B')] }, ko)!.line).toBe('5-5: 둘 다 수비, 포인트는 상대가 가져갔어요');
  });

  it('builds the result screen in Korean from the same record', () => {
    const s = playLadderMatch(freshLadder()).next;
    const r = s.history.at(-1)!;
    const v = quickResultView(s, ko);
    const e = quickResultView(s);
    expect(v.headline).toBe(`${r.won ? '승리' : '패배'} ${r.score}`);
    expect(v.decisive).toEqual(highlightOf(r, ko));
    expect(v.decisive!.point).toBe(e.decisive!.point);
    expect(v.playByPlay).toHaveLength(e.playByPlay.length);
    expect(v.playByPlay.at(-1)).toMatch(/^(내|상대) 포인트/);
    expect(v.ratings.map((x) => x.key)).toEqual(e.ratings.map((x) => x.key));
    expect(v.goal.winsNeeded).toBe(nextGoal(s).winsNeeded);
    expect(v.goal.label).toBe(nextGoal(s, ko).label);
  });

  it('labels the ladder home in Korean', () => {
    const s = freshLadder();
    const v = quickHomeView(s, ko);
    expect(['하드', '클레이', '잔디']).toContain(v.opponent.surface);
    expect(Object.values(ko.style)).toContain(v.opponent.style);
  });

  it('shows the same tell in either language: the index is drawn, the words come later', () => {
    const m = toDecision(ladderWithDecision(freshLadder()));
    const tell = m.pending!.tell!;
    expect(opponentRead(m).tell).toBe(en.tells[tell.card][tell.index]);
    expect(opponentRead(m, ko).tell).toBe(ko.tells[tell.card][tell.index]);
  });
});
