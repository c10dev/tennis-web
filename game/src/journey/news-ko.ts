// Headlines (ADR-032/033): press lines in 다/했다 style, the most notable thing first. Korean only (TD-080).
// {placeholders} come from facts.ts.
import type { Facts } from './facts.ts';

export type Tone = 'big' | 'good' | 'bad' | 'plain';

export interface Template {
  id: string;
  tone: Tone;
  when: (f: Facts) => boolean;
  news: readonly string[];
}

const titleOf = (f: Facts, tier: string) => f.titles.some((e) => e.tier === tier);

/** Most notable first: the first match is the lead headline. */
export const TEMPLATES: readonly Template[] = [
  {
    id: 'major-title', tone: 'big', when: (f) => f.majorTitle,
    news: ['{nameTopic} {title} 정상에 섰다. 커리어 메이저 {majors}번째 우승', '{name}, {title} 우승… 결승에서 {titleOppObj} 꺾었다 ({titleScore})', '역사가 쓰였다. {name}, {title} 챔피언'],
  },
  {
    id: 'major-final', tone: 'good', when: (f) => f.majorFinal,
    news: ['{name}, {major} 준우승… 결승에서 {majorOppWith} 접전 끝에 무릎', '{nameTopic} {major} 우승컵을 아쉽게 놓쳤지만 세계를 놀라게 했다'],
  },
  {
    id: 'major-semi', tone: 'good', when: (f) => f.majorSemi,
    news: ['{name}, {major} 4강 진출… 세계 무대에서 존재감', '{nameTopic} {major}에서 4강까지 올랐다'],
  },
  {
    id: 'finals-title', tone: 'big', when: (f) => titleOf(f, 'finals'),
    news: ['{name}, 투어 파이널스 우승… 시즌 최강자 증명'],
  },
  {
    id: 'masters-title', tone: 'big', when: (f) => titleOf(f, 'masters'),
    news: ['{name}, {title} 제패… 마스터스 트로피를 품었다', '{nameTopic} {title} 우승으로 정상급 선수임을 증명했다'],
  },
  {
    id: 'junior-major', tone: 'big', when: (f) => f.juniorMajorTitle,
    news: ['{age}세 {name}, {title} 우승… 주니어 무대 평정', '될성부른 떡잎. {nameTopic} {title} 챔피언에 올랐다'],
  },
  {
    id: 'title', tone: 'good', when: (f) => f.titles.length > 0,
    news: ['{name}, {title} 우승… 통산 {titles}번째 타이틀', '{nameTopic} {title} 결승에서 {titleOppObj} 꺾고 정상에 올랐다 ({titleScore})', '{name}, {title} 트로피 들어 올렸다'],
  },
  {
    id: 'climb', tone: 'good', when: (f) => (f.climb ?? 0) >= 20 && f.rank !== null,
    news: ['{name}, 세계 랭킹 {climb}계단 뛰어올라 {rank}위', '{nameTopic} 이번 구간 상승세로 {rank}위까지 올랐다'],
  },
  {
    id: 'deep-run', tone: 'good', when: (f) => !!f.best && f.best.roundsWon >= f.best.rounds - 2 && !f.best.champion,
    news: ['{name}, {event} {eventReached}… 좋은 흐름 이어갔다', '{nameTopic} {event}에서 {eventReached}까지 올랐다'],
  },
  {
    id: 'injured', tone: 'bad', when: (f) => f.injured,
    news: ['{name}, 부상으로 당분간 코트를 떠난다', '악재. {nameTopic} 재활에 들어갔다'],
  },
  {
    id: 'away', tone: 'plain', when: (f) => f.away,
    news: ['{nameTopic} 이번 구간 코트에 서지 않았다', '{name}, 조용한 구간을 보냈다'],
  },
  {
    id: 'slump', tone: 'bad', when: (f) => f.lost >= 3 && f.won <= 1,
    news: ['{name}, {won}승 {lost}패… 깊어지는 부진', '{name}, 이번 구간 승리를 거의 챙기지 못했다'],
  },
  {
    id: 'junior', tone: 'plain', when: (f) => f.junior,
    news: ['{age}세 {name}, 주니어 무대에서 {won}승 {lost}패', '주니어 {nameTopic} 경험을 쌓고 있다'],
  },
  {
    id: 'plain', tone: 'plain', when: () => true,
    news: ['{name}, {event} {eventReachedBy} 구간 마무리', '{name}, 이번 구간 {won}승 {lost}패'],
  },
];

/** Toasts for milestones (settle.ts ids). */
export const MILESTONES: Record<string, string> = {
  'first-win': '첫 승리!',
  'first-junior-title': '첫 주니어 타이틀!',
  'junior-major': '주니어 메이저 우승!',
  'junior-no1': '주니어 세계 1위!',
  'first-pro-points': '첫 프로 랭킹 포인트',
  'first-title': '첫 프로 타이틀!',
  'major-main-draw': '첫 메이저 본선',
  'masters-title': '마스터스 우승!',
  'major-final': '첫 메이저 결승',
  'major-title': '메이저 챔피언!',
  finals: '투어 파이널스 진출',
  top100: '세계 100위 진입',
  top50: '세계 50위 진입',
  top10: '톱10 진입!',
  top1: '세계 랭킹 1위!',
};
