// Korean (ADR-022), for the Apps in Toss build. Particles follow the card names (공격이, 수비가); after a player's
// (Latin) name the lines use a dash instead, so no particle has to be guessed.
import type { Card, PlayStyle, ShotType } from '@tennis/engine';
import type { Habit } from '../quick/types.ts';
import { surname, type Messages } from './types.ts';

/** The word with the particle its last syllable takes: 받침 → `withFinal`, none → `without`; non-Hangul → both. */
export function withJosa(word: string, withFinal: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 0xd7a3 - 0xac00) return `${word}${withFinal}(${without})`;
  return `${word}${code % 28 ? withFinal : without}`;
}

const HABIT: Record<Habit, string> = {
  big_point_attack: '매치 포인트에서 과감하게 공격해요',
  counter_after_loss: '포인트를 잃으면 카운터로 받아쳐요',
  repeat_card: '지난 승부처의 카드를 또 내요',
  defend_unless_behind: '뒤지지 않으면 안전하게 수비해요',
  copy_user: '지난 승부처의 내 카드를 따라 해요',
  beat_user_last: '지난 승부처의 내 카드를 이기는 카드를 내요',
};

const WHY: Partial<Record<PlayStyle, string>> = {
  big_server: '빅 서버는 긴 랠리에서 리듬을 잃어요',
  baseliner: '베이스라이너의 시간을 빼앗으세요',
  counter_puncher: '카운터펀처에게 속도를 주지 말되, 물러서지도 마세요',
};

const CARD: Record<Card, string> = { attack: '공격', defend: '수비', counter: '카운터' };
const WING = { forehand: '포핸드', backhand: '백핸드' } as const;
const SHOT: Partial<Record<ShotType, string>> = { serve: '서브', lob: '로브', drop: '드롭샷', volley: '발리', overhead: '스매시' };
const who = (user: boolean) => (user ? '내' : '상대');
const taker = (user: boolean) => (user ? '내가' : '상대가');

export const ko: Messages = {
  lang: 'ko',
  card: CARD,
  flavour: {
    serve: { attack: '강서브', defend: '안전한 서브', counter: '리턴 유도' },
    return: { attack: '앞으로 들어가기', defend: '깊게 막기', counter: '서브 읽기' },
  },
  situation: (role, score) => `${role === 'serve' ? '내 서브' : '상대 서브'} · ${score}`,
  moment: { matchPoint: '매치 포인트', matchPointDown: '매치 포인트 위기', all: (n) => `${n}-${n} 동점`, big: '승부처' },
  caption: {
    setPoint: '세트 포인트', setPointDown: '세트 포인트 위기', breakPoint: '브레이크 포인트', breakPointDown: '브레이크 포인트 위기',
    run: (n, won) => `${n}연속 ${won ? '득점' : '실점'}`,
  },
  how: { ace: '에이스', double_fault: '더블 폴트', winner: '위너', unforced_error: '언포스드 에러', forced_error: '포스드 에러', other: '실수' },
  plan: {
    aggressive: { label: '공격적', line: '과감하게: 위너도 실수도 늘어요' },
    balanced: { label: '균형', line: '확률 높은 플레이' },
    defensive: { label: '수비적', line: '한 번 더 넘겨 실수를 끌어내요' },
  },
  style: { big_server: '빅 서버', baseliner: '베이스라이너', counter_puncher: '카운터펀처', serve_and_volley: '서브 앤 발리', all_court: '올코트' },
  surface: { hard: '하드', clay: '클레이', grass: '잔디' },
  rating: {
    servePower: '서브 파워', serveAccuracy: '서브 정확도', secondServe: '세컨드 서브', forehand: '포핸드', backhand: '백핸드',
    consistency: '안정성', return: '리턴', movement: '움직임', agility: '민첩성', stamina: '체력', composure: '침착함',
    concentration: '집중력', decision: '판단력', aggression: '공격성',
  },
  habit: (name, h) => `${surname(name)} — ${HABIT[h]}`,
  scouting: (name, style, h) => `${name} · ${style} — ${HABIT[h]}`,
  rival({ wins, losses }, stance, last) {
    const how = !stance ? '' : stance.kind === 'wary' ? ` · 습관을 읽힌 걸 알아요: 습관 대신 ${stance.card ? withJosa(CARD[stance.card], '으로', '로') : '내 대응을 이기는 카드로'} 바꿀 수 있어요` : ' · 자신만만: 습관을 더 고집해요';
    return `상대 전적 ${wins}승 ${losses}패${how}${last ? ` · 지난 승부처: ${CARD[last]}` : ''}`;
  },
  planTip: (plan, style) => `작전 팁: ${ko.plan[plan].label}${WHY[style] ? ` — ${WHY[style]}` : ''}`,
  tells: {
    attack: ['발끝으로 통통 뛰며 들어올 기세예요', '베이스라인 안쪽으로 슬금슬금 들어와요', '라켓을 꽉 쥐고 라인을 노려봐요', '공을 빠르게 튀기며 조급해 보여요'],
    defend: ['베이스라인 뒤로 물러나요', '무릎을 굽히고 깊숙이 자리 잡아요', '숨을 길게 고르며 템포를 늦춰요', '수건으로 땀을 닦으며 여유를 부려요'],
    counter: ['가볍게 좌우로 스텝을 밟아요', '내 발을 유심히 지켜봐요', '라켓을 앞으로 짧게 내밀고 있어요', '반걸음 들어왔다가 다시 물러나요'],
  },
  decisive({ score, user, ai, matchup, won }) {
    if (matchup === 0) return `${score}: 둘 다 ${CARD[user]}, 포인트는 ${taker(won)} 가져갔어요`;
    const [winner, loser] = matchup > 0 ? [`내 ${CARD[user]}`, `상대 ${CARD[ai]}`] : [`상대 ${CARD[ai]}`, `내 ${CARD[user]}`];
    const end = (matchup > 0) === won ? '어요' : `지만, 포인트는 ${taker(won)} 가져갔어요`;
    return `${score}: ${withJosa(winner, '이', '가')} ${withJosa(loser, '을', '를')} 꺾었${end}`;
  },
  noCards: (won) => (won ? '작전대로 밀어붙였어요' : '상대가 경기를 매듭지었어요'),
  headline: (won, score) => `${won ? '승리' : '패배'} ${score}`,
  concededHeadline: (score) => `기권패 ${score}`,
  goal: { stay: '1위 지키기', first: '1위', top: (n) => `${n}위권`, line: (wins, label) => `${label}까지 ${wins}승` },
  pbp: {
    opening: (score, userServes) => `${score} · ${userServes ? '내 서브' : '상대 서브'}`,
    cards: (user, ai) => `나 ${CARD[user]}, 상대 ${CARD[ai]}`,
    noCards: '카드 없음: 내 작전대로',
    serve: (first, kmh) => `${first ? '첫' : '세컨드'} 서브, ${kmh} km/h`,
    rally: (shots) => `${shots}구 랠리`,
    stroke: (shot, wing) => (shot === 'drive' || shot === 'return' || shot === 'approach' ? WING[wing] : shot === 'slice' ? `${WING[wing]} 슬라이스` : SHOT[shot] ?? shot),
    ending(kind, user, stroke) {
      if (kind === 'ace') return `${who(user)} 에이스`;
      if (kind === 'double_fault') return `${who(user)} 더블 폴트`;
      if (kind === 'winner') return `${who(user)} ${stroke} 위너`;
      return `${who(user)} ${stroke} ${kind === 'forced_error' ? '포스드 에러' : '실수'}`;
    },
    close: (userWon, over, score) => `${userWon ? '내 포인트' : '상대 포인트'}${over ? ' · 게임, 세트, 매치' : ` · ${score}`}`,
  },
};
