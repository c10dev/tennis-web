// Life events between swings (ADR-032): small decisions with a trade-off, a few of them a gamble. Korean only (TD-080).
import type { LifeEvent } from './events.ts';
import { nameVars, particles } from './vars.ts';
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
    id: 'video', kind: 'life', title: '영상 분석', every: 8, vars: name,
    text: '코치가 상위 랭커들의 리턴 영상을 밤새 함께 보자고 해요.',
    when: (s) => junior(s) || s.user.stage === 'college',
    options: [
      { id: 'watch', label: '밤새 분석한다', detail: '리턴 위치를 새로 배워요. 조금 피곤해요.', effect: { gain: 0.15, groups: ['return'], fatigue: 0.05 } },
      { id: 'sleep', label: '푹 잔다', detail: '컨디션을 지켜요.', effect: { fatigue: -0.1 } },
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
    id: 'charity', kind: 'life', title: '자선 경기', every: 12, vars: name,
    text: '어린이 병원을 돕는 자선 경기에 초대받았어요.',
    when: (s) => active(s) && s.user.reputation >= 10 && s.user.money >= 5000,
    options: [
      { id: 'play', label: '참가하고 상금을 기부한다', detail: '마음이 따뜻해지고 명성도 올라요.', effect: { money: -3000, reputation: 4, morale: 3 }, note: '{name}, 자선 경기 상금 전액 기부' },
      { id: 'skip', label: '일정상 어렵다', detail: '훈련을 지켜요.', effect: {} },
    ],
  },
];
