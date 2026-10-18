// The career at its end (ADR-032): the record and a grade.
import { NATIONS } from './names.ts';
import type { JourneyState, Nation } from './types.ts';

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
}

export function summarize(s: JourneyState): CareerSummary {
  const st = s.stats;
  const p = s.user.player;
  return {
    name: p.name, nation: NATIONS[p.nation as Nation].name, retiredAt: p.age, grade: grade(st.majors, st.bestRank),
    majors: st.majors, majorWins: st.majorWins, titles: st.titles, bestRank: st.bestRank, weeksAtOne: st.swingsAtOne * 13,
    wins: st.wins, losses: st.losses, prize: st.prize, juniorMajors: st.juniorMajors, bestJuniorRank: st.bestJuniorRank,
    peakOvr: s.user.peak,
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
