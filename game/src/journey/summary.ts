// The career at its end (ADR-032): the record, a grade, and the retired legend it most resembles. Legends are real
// retired players named for comparison only (career numbers as of their retirement).
import type { PlayStyle } from '@tennis/engine';
import { NATIONS } from './names.ts';
import type { JourneyState, Nation } from './types.ts';

interface Legend {
  name: string;
  nation: string;
  majors: number;
  best: number;
  titles: number;
  weeksAtOne: number;
  style: PlayStyle;
}

const LEGENDS: readonly Legend[] = [
  { name: '로저 페더러', nation: '스위스', majors: 20, best: 1, titles: 103, weeksAtOne: 310, style: 'all_court' },
  { name: '라파엘 나달', nation: '스페인', majors: 22, best: 1, titles: 92, weeksAtOne: 209, style: 'baseliner' },
  { name: '피트 샘프러스', nation: '미국', majors: 14, best: 1, titles: 64, weeksAtOne: 286, style: 'big_server' },
  { name: '안드레 애거시', nation: '미국', majors: 8, best: 1, titles: 60, weeksAtOne: 101, style: 'baseliner' },
  { name: '앤디 머리', nation: '영국', majors: 3, best: 1, titles: 46, weeksAtOne: 41, style: 'counter_puncher' },
  { name: '구스타보 쿠에르텐', nation: '브라질', majors: 3, best: 1, titles: 20, weeksAtOne: 43, style: 'baseliner' },
  { name: '레이턴 휴잇', nation: '호주', majors: 2, best: 1, titles: 30, weeksAtOne: 80, style: 'counter_puncher' },
  { name: '마라트 사핀', nation: '러시아', majors: 2, best: 1, titles: 15, weeksAtOne: 9, style: 'big_server' },
  { name: '앤디 로딕', nation: '미국', majors: 1, best: 1, titles: 32, weeksAtOne: 13, style: 'big_server' },
  { name: '마이클 창', nation: '미국', majors: 1, best: 2, titles: 34, weeksAtOne: 0, style: 'counter_puncher' },
  { name: '후안 마르틴 델 포트로', nation: '아르헨티나', majors: 1, best: 3, titles: 22, weeksAtOne: 0, style: 'big_server' },
  { name: '도미니크 팀', nation: '오스트리아', majors: 1, best: 3, titles: 17, weeksAtOne: 0, style: 'baseliner' },
  { name: '다비드 페레르', nation: '스페인', majors: 0, best: 3, titles: 27, weeksAtOne: 0, style: 'counter_puncher' },
  { name: '토마시 베르디흐', nation: '체코', majors: 0, best: 4, titles: 13, weeksAtOne: 0, style: 'big_server' },
  { name: '조윌프리드 총가', nation: '프랑스', majors: 0, best: 5, titles: 18, weeksAtOne: 0, style: 'all_court' },
  { name: '존 이스너', nation: '미국', majors: 0, best: 8, titles: 16, weeksAtOne: 0, style: 'big_server' },
  { name: '이형택', nation: '대한민국', majors: 0, best: 36, titles: 1, weeksAtOne: 0, style: 'baseliner' },
];

export interface CareerSummary {
  name: string;
  nation: string;
  retiredAt: number;
  grade: string;
  majors: number;
  majorWins: string[];
  titles: number;
  bestRank: number | null;
  weeksAtOne: number;
  wins: number;
  losses: number;
  prize: number;
  juniorMajors: number;
  bestJuniorRank: number | null;
  peakOvr: number;
  legend: { name: string; nation: string; similarity: number; line: string } | null;
}

export function summarize(s: JourneyState): CareerSummary {
  const st = s.stats;
  const p = s.user.player;
  return {
    name: p.name, nation: NATIONS[p.nation as Nation].name, retiredAt: p.age, grade: grade(st.majors, st.bestRank),
    majors: st.majors, majorWins: st.majorWins, titles: st.titles, bestRank: st.bestRank, weeksAtOne: st.swingsAtOne * 13,
    wins: st.wins, losses: st.losses, prize: st.prize, juniorMajors: st.juniorMajors, bestJuniorRank: st.bestJuniorRank,
    peakOvr: s.user.peak, legend: lookalike(s),
  };
}

export function grade(majors: number, best: number | null): string {
  if (majors >= 10) return 'GOAT 논쟁의 주인공';
  if (majors >= 3) return '테니스 레전드';
  if (majors >= 1) return '메이저 챔피언';
  if (best === null) return '꿈을 좇은 도전자';
  if (best <= 10) return '톱10 플레이어';
  if (best <= 50) return '투어 정상급 선수';
  if (best <= 100) return '투어 선수';
  if (best <= 300) return '챌린저 단골';
  return '꿈을 좇은 도전자';
}

function lookalike(s: JourneyState): CareerSummary['legend'] {
  const st = s.stats;
  if (st.bestRank === null || st.bestRank > 150) return null;
  const weeks = st.swingsAtOne * 13;
  const score = (l: Legend) => {
    const rank = 1 - Math.min(1, Math.abs(Math.log(st.bestRank!) - Math.log(l.best)) / 3);
    const majors = 1 - Math.min(1, Math.abs(Math.log1p(st.majors) - Math.log1p(l.majors)) / 2);
    const titles = 1 - Math.min(1, Math.abs(Math.log1p(st.titles) - Math.log1p(l.titles)) / 2.5);
    const top = 1 - Math.min(1, Math.abs(Math.log1p(weeks) - Math.log1p(l.weeksAtOne)) / 4);
    const style = l.style === s.user.player.style ? 1 : 0;
    const home = l.nation === NATIONS[s.user.player.nation].name ? 1 : 0;
    return 0.3 * majors + 0.25 * rank + 0.2 * titles + 0.1 * top + 0.1 * style + 0.05 * home;
  };
  const best = [...LEGENDS].sort((a, b) => score(b) - score(a) || (a.name < b.name ? -1 : 1))[0]!;
  const line = best.majors ? `메이저 ${best.majors}회 · 최고 ${best.best}위 · 통산 ${best.titles}승` : `최고 ${best.best}위 · 통산 ${best.titles}승`;
  return { name: best.name, nation: best.nation, similarity: Math.round(60 + 38 * score(best)), line };
}
