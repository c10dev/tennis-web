// Life events between swings (ADR-032): small decisions with a trade-off, a few of them a gamble. Korean only (TD-080).
import type { LifeEvent } from './events.ts';
import { nameVars, particles } from './vars.ts';
import { total } from './ranking.ts';
import type { JourneyState } from './types.ts';

const name = (s: JourneyState) => nameVars(s.user.player.name);
const junior = (s: JourneyState) => s.user.stage === 'junior';
const active = (s: JourneyState) => s.user.stage !== 'retired';

/** The AI the user has met most, with their name, if any twice. */
function rival(s: JourneyState): { id: string; name: string } | null {
  const met = Object.entries(s.stats.h2h).filter(([, [w, l]]) => w + l >= 2).sort(([, a], [, b]) => b[0] + b[1] - a[0] - a[1]);
  for (const [id] of met) {
    const p = s.pros.find((x) => x.id === id) ?? s.juniors.find((x) => x.id === id);
    if (p) return { id, name: p.name };
  }
  return null;
}

export const LIFE_EVENTS: LifeEvent[] = [
  {
    id: 'parent-surgery', kind: 'life', title: '부모님의 수술 소식', vars: name,
    text: '어머니가 수술을 받게 됐다는 연락이 왔어요. 그런데 훈련 일정이 빡빡해요.',
    when: active,
    options: [
      { id: 'home', label: '곁을 지킨다', detail: '마음이 단단해지지만 몸 만들기는 늦어져요.', effect: { morale: 5, gain: -0.1 } },
      { id: 'train', label: '훈련하고 매일 영상통화를 한다', detail: '몸은 제때 만들지만 마음 한쪽이 무거워요.', effect: { morale: -3, gain: 0.15, groups: ['physical'] } },
    ],
  },
  {
    id: 'school-exam', kind: 'life', title: '기말고사', every: 8, vars: name,
    text: '기말고사가 코앞인데 대회 준비 훈련도 이어지고 있어요.',
    when: (s, c) => junior(s) && c.age <= 17,
    options: [
      { id: 'study', label: '시험공부를 한다', detail: '부모님은 기뻐하지만 감각이 조금 무뎌져요.', effect: { morale: 3, gain: -0.05 } },
      { id: 'train', label: '라켓을 잡는다', detail: '스트로크는 좋아지지만 성적표가 걱정이에요.', effect: { morale: -2, gain: 0.15, groups: ['forehand', 'backhand'] } },
    ],
  },
  {
    id: 'video', kind: 'life', title: '영상 분석', every: 8, vars: name,
    text: '코치가 상위 랭커들의 리턴 영상을 밤새 함께 보자고 해요.',
    when: (s) => junior(s) || s.user.stage === 'college',
    options: [
      { id: 'watch', label: '밤새 분석한다', detail: '리턴 위치를 새로 배워요. 조금 피곤해요.', effect: { gain: 0.15, groups: ['return'], fatigue: 0.05 } },
      { id: 'sleep', label: '푹 잔다', detail: '컨디션을 지켜요.', effect: { fatigue: -0.1 } },
    ],
  },
  {
    id: 'dating', kind: 'life', title: '열애설', vars: name,
    text: '연인과 함께 있는 사진이 찍혔어요. 공개할지, 조용히 넘어갈지 정해야 해요.',
    when: (s, c) => active(s) && c.age >= 19 && c.age <= 34,
    options: [
      { id: 'reveal', label: '당당하게 공개한다', detail: '축하를 받을 수도, 집중력 논란에 휩싸일 수도 있어요.', gamble: { chance: 0.5, win: { morale: 6, reputation: 2 }, lose: { morale: -3, reputation: -2 }, winText: '팬들의 축하가 쏟아지고 마음이 한결 편해졌다', loseText: '경기력이 떨어질 때마다 연애 이야기가 따라붙었다' } },
      { id: 'quiet', label: '사생활이라며 말을 아낀다', detail: '조용히 넘어가지만 조금 피곤해요.', effect: { morale: 1 } },
    ],
  },
  {
    id: 'dog', kind: 'life', title: '반려견 입양', vars: name,
    text: '훈련장 근처 보호소에서 눈이 마주친 강아지가 있어요.',
    when: active,
    options: [
      { id: 'adopt', label: '데려온다', detail: '투어 생활에 위로가 돼요. 돌봄 비용이 들어요.', effect: { morale: 6, money: -2000 }, note: '{name}의 SNS에 새 가족이 등장했다' },
      { id: 'no', label: '지금은 어렵다', detail: '투어가 너무 바빠요.', effect: { morale: -1 } },
    ],
  },
  {
    id: 'documentary', kind: 'life', title: '다큐멘터리 제안', vars: name,
    text: 'OTT 플랫폼이 한 시즌 동안 {name}의 일상을 따라다니는 다큐멘터리를 찍자고 해요.',
    when: (s) => active(s) && s.user.reputation >= 25,
    options: [
      { id: 'film', label: '촬영한다', detail: '명성과 출연료를 얻지만 카메라가 부담돼요.', effect: { reputation: 6, money: 20000, fatigue: 0.08, morale: -2 }, note: '{name} 다큐멘터리 제작 확정' },
      { id: 'decline', label: '거절한다', detail: '테니스에만 집중해요.', effect: { morale: 1 } },
    ],
  },
  {
    id: 'altitude', kind: 'life', title: '고지대 훈련 캠프', every: 8, vars: name,
    text: '비시즌에 고지대 훈련 캠프에 갈 수 있어요. 비용이 꽤 들어요.',
    when: (s) => active(s) && s.user.money >= 10000,
    options: [
      { id: 'go', label: '캠프에 간다', detail: '체력이 좋아지지만 몸이 지쳐요.', effect: { gain: 0.25, groups: ['physical'], money: -8000, fatigue: 0.1 } },
      { id: 'skip', label: '평소대로 훈련한다', detail: '돈을 아껴요.', effect: {} },
    ],
  },
  {
    id: 'psychologist', kind: 'life', title: '멘탈 코치', every: 8, vars: name,
    text: '중요한 순간마다 흔들린다는 분석이 나왔어요. 스포츠 심리 전문가를 만나 볼까요?',
    when: (s) => active(s) && s.user.money >= 8000,
    options: [
      { id: 'hire', label: '상담을 받는다', detail: '승부처에서 덜 흔들려요.', effect: { gain: 0.2, groups: ['mental'], money: -6000, morale: 3 } },
      { id: 'skip', label: '혼자 이겨낸다', detail: '비용을 아껴요.', effect: { morale: -1 } },
    ],
  },
  {
    id: 'sns', kind: 'life', title: 'SNS 논란', vars: name,
    text: '경기 후 올린 짧은 글이 오해를 사서 커뮤니티가 시끄러워요.',
    when: (s) => active(s) && s.user.reputation >= 15,
    options: [
      { id: 'apologize', label: '바로 사과한다', detail: '빠르게 진화되지만 조금 위축돼요.', effect: { reputation: -2, morale: -2 } },
      { id: 'ignore', label: '신경 쓰지 않는다', detail: '조용히 지나갈 수도, 커질 수도 있어요.', gamble: { chance: 0.5, win: { reputation: 2 }, lose: { reputation: -6, morale: -4 }, winText: '논란은 하루 만에 잠잠해졌다', loseText: '논란이 커지며 기사까지 났다' } },
    ],
  },
  {
    id: 'fan-meeting', kind: 'life', title: '팬 사인회', every: 8, vars: name,
    text: '팬 사인회에 예상보다 많은 팬이 몰렸어요. 오후엔 훈련이 잡혀 있어요.',
    when: (s) => active(s) && s.user.reputation >= 20,
    options: [
      { id: 'stay', label: '끝까지 사인한다', detail: '팬들이 감동하지만 훈련을 놓쳐요.', effect: { reputation: 3, morale: 3, fatigue: 0.05 } },
      { id: 'train', label: '훈련장으로 간다', detail: '아쉬워하는 팬도 있어요.', effect: { gain: 0.1, reputation: -1 } },
    ],
  },
  {
    id: 'rival', kind: 'life', title: '라이벌의 도발', every: 12,
    vars: (s) => ({ ...name(s), ...particles('rival', rival(s)?.name ?? '') }),
    text: '{rivalSubj} 인터뷰에서 "{nameTopic} 큰 경기에 약하다"고 말했어요.',
    when: (s) => active(s) && rival(s) !== null,
    options: [
      { id: 'answer', label: '맞받아친다', detail: '불이 붙을 수도, 역효과가 날 수도 있어요.', gamble: { chance: 0.5, win: { morale: 6, reputation: 3 }, lose: { morale: -4 }, winText: '{name}의 한마디에 팬들이 열광했다', loseText: '말싸움만 남았다는 비판이 나왔다' } },
      { id: 'court', label: '코트에서 보여준다', detail: '조용히 이를 악물어요.', effect: { gain: 0.1, groups: ['mental'], morale: 1 } },
    ],
  },
  {
    id: 'racket', kind: 'life', title: '새 라켓', every: 12, vars: name,
    text: '라켓 회사가 새 프레임을 써 보라고 보내왔어요. 감각이 꽤 달라요.',
    when: active,
    options: [
      { id: 'switch', label: '새 라켓으로 바꾼다', detail: '서브가 좋아질 수도, 적응에 애먹을 수도 있어요.', gamble: { chance: 0.55, win: { gain: 0.2, groups: ['serve'] }, lose: { gain: -0.1 }, winText: '새 라켓으로 서브 속도가 눈에 띄게 올랐다', loseText: '새 라켓 적응에 애를 먹었다' } },
      { id: 'keep', label: '쓰던 라켓을 지킨다', detail: '익숙한 감각을 유지해요.', effect: { morale: 1 } },
    ],
  },
  {
    id: 'serve-clinic', kind: 'life', title: '서브 클리닉', every: 8, vars: name,
    text: '전설적인 빅서버가 운영하는 서브 클리닉에 자리가 났어요.',
    when: (s) => active(s) && s.user.money >= 6000,
    options: [
      { id: 'go', label: '참가한다', detail: '서브가 좋아져요.', effect: { gain: 0.25, groups: ['serve'], money: -5000 } },
      { id: 'skip', label: '다음 기회에', detail: '돈을 아껴요.', effect: {} },
    ],
  },
  {
    id: 'burnout', kind: 'life', title: '번아웃', every: 8, weight: 3, vars: name,
    text: '아침에 라켓을 드는 게 버거워요. 몸도 마음도 지쳤어요.',
    when: (s) => active(s) && (s.user.player.fatigue >= 0.5 || s.user.morale <= 30),
    options: [
      { id: 'rest', label: '휴가를 떠난다', detail: '푹 쉬고 돌아와요.', effect: { fatigue: -0.4, morale: 8, gain: -0.05 } },
      { id: 'push', label: '그래도 버틴다', detail: '훈련은 이어가지만 더 지칠 수 있어요.', effect: { gain: 0.1, fatigue: 0.1, morale: -4 } },
    ],
  },
  {
    id: 'charity', kind: 'life', title: '자선 경기', every: 12, vars: name,
    text: '어린이 병원을 돕는 자선 경기에 초대받았어요.',
    when: (s) => active(s) && s.user.reputation >= 10 && s.user.money >= 5000,
    options: [
      { id: 'play', label: '참가하고 상금을 기부한다', detail: '마음이 따뜻해지고 명성도 올라요.', effect: { money: -3000, reputation: 4, morale: 3 }, note: '{name}, 자선 경기 상금 전액 기부' },
      { id: 'skip', label: '일정상 어렵다', detail: '훈련을 지켜요.', effect: {} },
    ],
  },
  {
    id: 'points-defend', kind: 'life', title: '포인트 방어', every: 8, vars: name,
    text: '작년 이맘때 딴 랭킹 포인트가 곧 빠져요. 이번 구간이 중요해요.',
    when: (s) => s.user.stage === 'pro' && total(s.points[s.user.player.id]) > 0 && (s.points[s.user.player.id]?.[s.swing] ?? 0) > 200,
    options: [
      { id: 'focus', label: '훈련 강도를 올린다', detail: '컨디션을 끌어올려요.', effect: { gain: 0.1, fatigue: 0.08 } },
      { id: 'calm', label: '평소처럼 준비한다', detail: '부담을 내려놔요.', effect: { morale: 2 } },
    ],
  },
];
