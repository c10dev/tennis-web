// Stage turns and offers (ADR-032/033): turning pro or going to college, national teams, service and retirement
// (coaches, sponsors and wild cards come from the team now). Korean only (TD-080).
import type { LifeEvent } from './events.ts';
import { nameVars } from './vars.ts';
import { ovr } from './ratings.ts';
import { STAGES } from './tuning.ts';
import type { JourneyState } from './types.ts';

const name = (s: JourneyState) => nameVars(s.user.player.name);
const pro = (s: JourneyState) => s.user.stage === 'pro';
export const calendarYear = (s: JourneyState): number => 2026 + s.year;
const asian = (s: JourneyState) => ['KOR', 'JPN', 'CHN'].includes(s.user.player.nation);

export const STAGE_EVENTS: LifeEvent[] = [
  {
    id: 'retire-forced', kind: 'stage', title: '마지막 경기', vars: name,
    text: '{name}의 몸이 더는 투어를 버티지 못해요. 은퇴할 시간이에요.',
    when: (s, c) => pro(s) && c.age >= STAGES.forced,
    options: [{ id: 'retire', label: '은퇴한다', detail: '커리어를 마무리해요.', effect: { stage: 'retired' } }],
  },
  {
    id: 'turn-pro', kind: 'stage', title: '진로 선택', vars: name,
    text: '열여덟 살. 주니어 무대가 끝났어요. {name}의 다음 무대를 정할 시간이에요.',
    when: (s, c) => s.user.stage === 'junior' && c.age >= STAGES.turnPro,
    options: [
      { id: 'pro', label: '프로로 전향한다', detail: '퓨처스부터 랭킹을 쌓아요. 상금은 적고 이동은 많아요.', effect: { stage: 'pro' }, note: '{name}, 프로 전향 선언. 이제 진짜 승부다' },
      { id: 'college', label: '미국 대학에 진학한다', detail: '2년 동안 대학 리그에서 뛰며 좋은 코치에게 배워요. 프로 랭킹은 늦게 시작해요.', effect: { stage: 'college', college: STAGES.collegeSwings, freeCoach: 2 }, note: '{name}, 장학생으로 미국 대학 진학' },
    ],
  },
  {
    id: 'early-pro', kind: 'stage', title: '이른 프로 전향 제안', vars: name,
    text: '주니어 무대를 휩쓴 {name}에게 매니지먼트사가 프로 전향과 계약금을 제안했어요.',
    when: (s, c) => s.user.stage === 'junior' && c.age >= 16 && c.age < STAGES.turnPro && ((c.juniorRank ?? 99) <= STAGES.earlyProJuniorRank || c.ovr >= STAGES.earlyProOvr),
    options: [
      { id: 'accept', label: '프로 무대에 뛰어든다', detail: '계약금 3만 달러와 함께 투어에 도전해요.', effect: { stage: 'pro', money: 30000, reputation: 5 }, note: '{name}, 주니어 졸업 전 프로 전향… 매니지먼트 계약' },
      { id: 'decline', label: '주니어 무대를 마무리한다', detail: '주니어 메이저 우승을 노리며 조금 더 다듬어요.', effect: { morale: 3 } },
    ],
  },
  {
    id: 'college-done', kind: 'stage', title: '대학 졸업', vars: name,
    text: '대학 리그를 마친 {name}. 이제 프로 투어가 기다려요.',
    when: (s) => s.user.stage === 'college' && s.user.college === 0,
    options: [{ id: 'pro', label: '프로 무대로', detail: '대학에서 쌓은 실력으로 투어에 도전해요.', effect: { stage: 'pro', reputation: 3 }, note: '{name}, 대학 졸업 후 프로 데뷔' }],
  },
  {
    id: 'service', kind: 'stage', title: '입영 통지서', vars: name,
    text: '병역 의무를 미룰 수 있는 나이가 끝났어요. {nameTopic} 상무에서 군 복무를 시작해요.',
    when: (s, c) => pro(s) && s.user.player.nation === 'KOR' && !s.user.exempt && c.age >= STAGES.serviceAge && c.age <= STAGES.serviceAge + 2,
    options: [{ id: 'serve', label: '입대한다', detail: '여섯 구간 동안 투어 대회에 나가지 못해요. 랭킹 포인트도 서서히 빠져요.', effect: { away: STAGES.serviceSwings, morale: -5 }, note: '{name}, 국군체육부대 입대. 전역 후 복귀를 다짐했다' }],
  },
  {
    id: 'retire-advice', kind: 'stage', title: '은퇴를 고민할 때', vars: name, every: STAGES.adviseEvery,
    text: '회복에 걸리는 시간이 눈에 띄게 길어졌어요. 기자회견마다 은퇴 질문이 나와요.',
    when: (s, c) => pro(s) && c.age < STAGES.forced && (c.age >= STAGES.adviseAlways
      || (c.age >= STAGES.adviseFrom && s.user.peak - c.ovr >= STAGES.adviseDrop && (c.rank === null || c.rank > STAGES.adviseRank))),
    options: [
      { id: 'retire', label: '라켓을 내려놓는다', detail: '마지막 대회를 고르고 투어에 작별 인사를 해요.', effect: { stage: 'retired' } },
      { id: 'continue', label: '한 시즌 더 도전한다', detail: '아직 보여줄 게 남았어요.', effect: { morale: 2 } },
    ],
  },
];

export const OFFERS: LifeEvent[] = [
  {
    id: 'davis-cup', kind: 'offer', title: '국가대항전 대표 발탁', every: 8, weight: 2, vars: name,
    text: '국가대표팀 감독이 {nameObj} 국가대항전 명단에 넣고 싶어 해요.',
    when: (s, c) => pro(s) && c.rank !== null && c.rank <= 300,
    options: [
      { id: 'play', label: '태극마크를 단다', detail: '명성이 오르지만 일정이 빡빡해져요.', effect: { reputation: 4, morale: 3, fatigue: 0.1 }, note: '{name}, 국가대항전 출전' },
      { id: 'decline', label: '투어에 집중한다', detail: '팬들의 아쉬움을 살 수 있어요.', effect: { reputation: -3 } },
    ],
  },
  {
    id: 'asian-games', kind: 'offer', title: '아시안게임', every: 16, weight: 6, vars: name,
    text: '아시안게임 대표로 뽑혔어요. 금메달이면 병역 특례도 따라와요.',
    when: (s, c) => asian(s) && calendarYear(s) % 4 === 2 && s.swing === 2 && c.age >= 17 && s.user.stage !== 'retired',
    options: [
      {
        id: 'go', label: '금메달에 도전한다', detail: '투어 한 구간을 비워야 해요.',
        gamble: { chance: (s) => Math.min(0.9, Math.max(0.05, (ovr(s.user.player) - 62) / 25)), win: { exempt: true, reputation: 10, morale: 10 }, lose: { morale: -3, reputation: 2 }, winText: '{name}, 아시안게임 금메달! 병역 특례까지 손에 넣었다', loseText: '{name}, 아시안게임 메달 도전은 아쉽게 끝났다' },
      },
      { id: 'skip', label: '투어에 집중한다', detail: '랭킹 포인트를 지켜요.', effect: { reputation: -2 } },
    ],
  },
  {
    id: 'olympics', kind: 'offer', title: '올림픽', every: 16, weight: 6, vars: name,
    text: '올림픽 테니스 대표로 선발됐어요. 메달은 평생 남아요.',
    when: (s, c) => pro(s) && calendarYear(s) % 4 === 0 && s.swing === 2 && c.rank !== null && c.rank <= 60,
    options: [
      {
        id: 'go', label: '메달에 도전한다', detail: '나라를 대표해 뛰어요.',
        gamble: { chance: (s) => rankChance(s), win: { exempt: true, reputation: 15, morale: 10 }, lose: { morale: -2, reputation: 3 }, winText: '{name}, 올림픽 메달! 시상대 위에서 국기를 바라봤다', loseText: '{name}, 올림픽 메달 문턱에서 멈췄다' },
      },
      { id: 'skip', label: '투어에 집중한다', detail: '일정을 아껴요.', effect: { reputation: -3 } },
    ],
  },
];

function rankChance(s: JourneyState): number {
  const best = s.stats.bestRank ?? 999;
  return best <= 5 ? 0.6 : best <= 20 ? 0.3 : 0.12;
}
