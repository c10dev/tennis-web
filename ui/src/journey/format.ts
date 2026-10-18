// Korean labels for the tour screens (ADR-033; Korean only, TD-080).
import type { Entry, JTier, Region, Role, CoachStyle } from '@tennis/game';

export const TIER: Record<JTier, string> = {
  jr: '주니어', jrMajor: '주니어 메이저', futures: '퓨처스', challenger: '챌린저', t250: '투어 250', masters: '마스터스', major: '메이저', finals: '파이널스',
};
export const SURFACE: Record<string, string> = { hard: '하드', clay: '클레이', grass: '잔디' };
export const REGION: Record<Region, string> = { oceania: '오세아니아', asia: '아시아', middleeast: '중동', europe: '유럽', americas: '아메리카' };
export const ROLE: Record<Role, string> = { coach: '코치', physio: '피지오', agent: '에이전트' };
export const COACH_STYLE: Record<CoachStyle, string> = { attack: '공격형 (서브·포핸드)', defense: '수비형 (리턴·체력)', mind: '멘탈형 (멘탈·백핸드)', allround: '올라운드' };
export const STYLE: Record<string, string> = { big_server: '빅 서버', baseliner: '베이스라이너', counter_puncher: '카운터펀처', all_court: '올코트' };

export function entryLabel(entry: Entry, qualify: number): string {
  if (entry === 'direct') return '본선 직행';
  if (entry === 'qualifying') return `예선 · 통과 ${Math.round(qualify * 100)}%`;
  return '랭킹 부족';
}

export const money = (v: number): string => `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
export const rankText = (r: number | null): string => (r === null ? '랭킹 없음' : `${r}위`);
export const pct = (v: number): string => `${Math.round(v * 100)}%`;

export function remaining(ms: number): string {
  if (ms <= 0) return '마감';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `${h}시간 ${m}분 남음` : `${m}분 남음`;
}
