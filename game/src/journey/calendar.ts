// The tour's year (ADR-032/033): four swings of 12 weeks, each with one Major, the last with the Finals. Events are
// fictional, named after their cities; each has a week, a length and a region for travel. Points are by rounds won (a bye counts), modelled on the ATP and ITF scales.
import type { Surface } from '@tennis/engine';
import type { JTier } from './types.ts';

export interface JTierSpec {
  draw: number;
  bestOf: 3 | 5;
  /** points[r] for a player who won r rounds; the last entry is the champion's. */
  points: readonly number[];
  /** Prize money per ranking point, in dollars (junior events pay none). */
  prizePerPoint: number;
  junior: boolean;
  /** AI pros (or juniors) ranked in [from, to] enter with this chance; empty places go to unnamed players. */
  band: readonly [number, number];
  chance: number;
  /** Level (1–20 overall) of the unnamed players that fill a draw: mean and spread. */
  filler: readonly [number, number];
}

export const JTIERS: Record<JTier, JTierSpec> = {
  jr: { draw: 32, bestOf: 3, points: [0, 20, 40, 80, 150, 300], prizePerPoint: 0, junior: true, band: [1, 999], chance: 0.5, filler: [9.6, 0.8] },
  jrMajor: { draw: 64, bestOf: 3, points: [10, 40, 80, 160, 300, 600, 1000], prizePerPoint: 0, junior: true, band: [1, 999], chance: 1, filler: [10, 0.8] },
  futures: { draw: 32, bestOf: 3, points: [0, 1, 2, 4, 7, 12], prizePerPoint: 300, junior: false, band: [200, 999], chance: 0.4, filler: [12, 0.7] },
  challenger: { draw: 32, bestOf: 3, points: [0, 4, 8, 15, 25, 40], prizePerPoint: 320, junior: false, band: [60, 999], chance: 0.7, filler: [13.2, 0.6] },
  t250: { draw: 32, bestOf: 3, points: [0, 25, 50, 100, 165, 250], prizePerPoint: 280, junior: false, band: [9, 250], chance: 0.65, filler: [14.2, 0.5] },
  masters: { draw: 64, bestOf: 3, points: [10, 50, 100, 200, 400, 650, 1000], prizePerPoint: 450, junior: false, band: [1, 999], chance: 0.95, filler: [14.4, 0.4] },
  major: { draw: 128, bestOf: 5, points: [10, 50, 100, 200, 400, 800, 1300, 2000], prizePerPoint: 900, junior: false, band: [1, 999], chance: 1, filler: [13.8, 0.5] },
  finals: { draw: 8, bestOf: 3, points: [200, 600, 1000, 1500], prizePerPoint: 1500, junior: false, band: [1, 8], chance: 1, filler: [16, 0.3] },
};

/** Tiers from the biggest down: the order a schedule fills in. */
export const TIER_ORDER: readonly JTier[] = ['finals', 'major', 'masters', 't250', 'challenger', 'futures', 'jrMajor', 'jr'];

export type Region = 'oceania' | 'asia' | 'middleeast' | 'europe' | 'americas';

export interface JEvent {
  id: string;
  name: string;
  tier: JTier;
  surface: Surface;
  /** First week in the swing (1–12) and how many weeks it takes (Majors two). */
  week: number;
  weeks: 1 | 2;
  region: Region;
}

export interface Swing {
  name: string;
  events: readonly JEvent[];
}

/** Weeks in a swing. */
export const SWING_WEEKS = 12;

const ev = (id: string, name: string, tier: JTier, surface: Surface, week: number, region: Region): JEvent =>
  ({ id, name, tier, surface, week, weeks: tier === 'major' || tier === 'jrMajor' ? 2 : 1, region });

export const SWINGS: readonly Swing[] = [
  {
    name: '호주 시즌',
    events: [
      ev('brisbane', '브리즈번 인터내셔널', 't250', 'hard', 1, 'oceania'), ev('perth-f', '퍼스 퓨처스', 'futures', 'hard', 1, 'oceania'),
      ev('brisbane-jr', '브리즈번 주니어 인터내셔널', 'jr', 'hard', 1, 'oceania'), ev('canberra-c', '캔버라 챌린저', 'challenger', 'hard', 2, 'oceania'),
      ev('traralgon-jr', '트랄라곤 주니어 인터내셔널', 'jr', 'hard', 2, 'oceania'), ev('melbourne', '멜버른 메이저', 'major', 'hard', 3, 'oceania'),
      ev('melbourne-jr', '멜버른 주니어 메이저', 'jrMajor', 'hard', 3, 'oceania'), ev('manila-f', '마닐라 퓨처스', 'futures', 'hard', 6, 'asia'),
      ev('doha', '도하 오픈', 't250', 'hard', 7, 'middleeast'), ev('busan-c', '부산 챌린저', 'challenger', 'hard', 8, 'asia'),
      ev('indian-wells', '인디언웰스 마스터스', 'masters', 'hard', 10, 'americas'),
    ],
  },
  {
    name: '클레이 시즌',
    events: [
      ev('monte-carlo', '몬테카를로 마스터스', 'masters', 'clay', 1, 'europe'), ev('estoril', '에스토릴 오픈', 't250', 'clay', 2, 'europe'),
      ev('antalya-f', '안탈리아 퓨처스', 'futures', 'clay', 2, 'europe'), ev('munich', '뮌헨 오픈', 't250', 'clay', 3, 'europe'),
      ev('cordoba-f', '코르도바 퓨처스', 'futures', 'clay', 3, 'americas'), ev('bordeaux-c', '보르도 챌린저', 'challenger', 'clay', 4, 'europe'),
      ev('milan-jr', '밀라노 주니어 트로피', 'jr', 'clay', 5, 'europe'), ev('rome', '로마 마스터스', 'masters', 'clay', 6, 'europe'),
      ev('santacroce-jr', '산타크로체 주니어 컵', 'jr', 'clay', 6, 'europe'), ev('prague-c', '프라하 챌린저', 'challenger', 'clay', 7, 'europe'),
      ev('paris', '파리 메이저', 'major', 'clay', 9, 'europe'), ev('paris-jr', '파리 주니어 메이저', 'jrMajor', 'clay', 9, 'europe'),
    ],
  },
  {
    name: '잔디 시즌',
    events: [
      ev('stuttgart', '슈투트가르트 오픈', 't250', 'grass', 1, 'europe'), ev('nottingham-f', '노팅엄 퓨처스', 'futures', 'grass', 1, 'europe'),
      ev('halle', '할레 오픈', 't250', 'grass', 2, 'europe'), ev('ilkley-c', '일클리 챌린저', 'challenger', 'grass', 2, 'europe'),
      ev('roehampton-jr', '로햄턴 주니어 그라스', 'jr', 'grass', 3, 'europe'), ev('london', '런던 메이저', 'major', 'grass', 4, 'europe'),
      ev('london-jr', '런던 주니어 메이저', 'jrMajor', 'grass', 4, 'europe'), ev('gimcheon-f', '김천 퓨처스', 'futures', 'hard', 7, 'asia'),
      ev('yeongwol-jr', '영월 주니어 인터내셔널', 'jr', 'hard', 8, 'asia'), ev('seoul-c', '서울 챌린저', 'challenger', 'hard', 8, 'asia'),
      ev('toronto', '토론토 마스터스', 'masters', 'hard', 11, 'americas'),
    ],
  },
  {
    name: '북미·아시아 하드 시즌',
    events: [
      ev('chicago-c', '시카고 챌린저', 'challenger', 'hard', 1, 'americas'), ev('tulsa-f', '털사 퓨처스', 'futures', 'hard', 1, 'americas'),
      ev('college-park-jr', '칼리지파크 주니어 컵', 'jr', 'hard', 2, 'americas'), ev('newyork', '뉴욕 메이저', 'major', 'hard', 3, 'americas'),
      ev('newyork-jr', '뉴욕 주니어 메이저', 'jrMajor', 'hard', 3, 'americas'), ev('seoul', '코리아 오픈', 't250', 'hard', 6, 'asia'),
      ev('changwon-f', '창원 퓨처스', 'futures', 'hard', 6, 'asia'), ev('tokyo', '도쿄 오픈', 't250', 'hard', 7, 'asia'),
      ev('shenzhen-c', '선전 챌린저', 'challenger', 'hard', 7, 'asia'), ev('osaka-jr', '오사카 주니어 오픈', 'jr', 'hard', 8, 'asia'),
      ev('shanghai', '상하이 마스터스', 'masters', 'hard', 8, 'asia'), ev('finals', '투어 파이널스', 'finals', 'hard', 11, 'europe'),
    ],
  },
];

/** Weeks an event occupies. */
export const weeksOf = (e: Pick<JEvent, 'week' | 'weeks'>): number[] => Array.from({ length: e.weeks }, (_, i) => e.week + i);

export const eventById = (swing: number, id: string): JEvent | undefined => SWINGS[swing]!.events.find((e) => e.id === id);

export const pointsFor = (tier: JTier, roundsWon: number): number => JTIERS[tier].points[roundsWon]!;
export const roundsIn = (tier: JTier): number => Math.log2(JTIERS[tier].draw);
