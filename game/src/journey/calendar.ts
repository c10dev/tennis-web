// The text career's year (ADR-032): four swings, each ending at a Major (the last one also at the Finals). Events are
// fictional, named after their cities. Points are by rounds won (a bye counts), modelled on the ATP and ITF scales.
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
  futures: { draw: 32, bestOf: 3, points: [0, 2, 4, 8, 15, 25], prizePerPoint: 60, junior: false, band: [90, 999], chance: 0.6, filler: [12.2, 0.7] },
  challenger: { draw: 32, bestOf: 3, points: [0, 8, 16, 30, 50, 80], prizePerPoint: 120, junior: false, band: [30, 260], chance: 0.55, filler: [13.4, 0.6] },
  t250: { draw: 32, bestOf: 3, points: [0, 25, 50, 100, 165, 250], prizePerPoint: 280, junior: false, band: [9, 200], chance: 0.5, filler: [14.2, 0.5] },
  masters: { draw: 64, bestOf: 3, points: [10, 50, 100, 200, 400, 650, 1000], prizePerPoint: 450, junior: false, band: [1, 999], chance: 0.95, filler: [14.4, 0.4] },
  major: { draw: 128, bestOf: 5, points: [10, 50, 100, 200, 400, 800, 1300, 2000], prizePerPoint: 900, junior: false, band: [1, 999], chance: 1, filler: [13.8, 0.5] },
  finals: { draw: 8, bestOf: 3, points: [200, 600, 1000, 1500], prizePerPoint: 1500, junior: false, band: [1, 8], chance: 1, filler: [16, 0.3] },
};

/** Tiers from the biggest down: the order a schedule fills in. */
export const TIER_ORDER: readonly JTier[] = ['finals', 'major', 'masters', 't250', 'challenger', 'futures', 'jrMajor', 'jr'];

export interface JEvent {
  id: string;
  name: string;
  tier: JTier;
  surface: Surface;
}

export interface Swing {
  name: string;
  events: readonly JEvent[];
}

const ev = (id: string, name: string, tier: JTier, surface: Surface): JEvent => ({ id, name, tier, surface });

export const SWINGS: readonly Swing[] = [
  {
    name: '호주 시즌',
    events: [
      ev('brisbane-jr', '브리즈번 주니어 인터내셔널', 'jr', 'hard'), ev('melbourne-jr', '멜버른 주니어 메이저', 'jrMajor', 'hard'),
      ev('perth-f', '퍼스 퓨처스', 'futures', 'hard'), ev('manila-f', '마닐라 퓨처스', 'futures', 'hard'),
      ev('canberra-c', '캔버라 챌린저', 'challenger', 'hard'), ev('busan-c', '부산 챌린저', 'challenger', 'hard'),
      ev('brisbane', '브리즈번 인터내셔널', 't250', 'hard'), ev('doha', '도하 오픈', 't250', 'hard'),
      ev('indian-wells', '인디언웰스 마스터스', 'masters', 'hard'), ev('melbourne', '멜버른 메이저', 'major', 'hard'),
    ],
  },
  {
    name: '클레이 시즌',
    events: [
      ev('milan-jr', '밀라노 주니어 트로피', 'jr', 'clay'), ev('paris-jr', '파리 주니어 메이저', 'jrMajor', 'clay'),
      ev('antalya-f', '안탈리아 퓨처스', 'futures', 'clay'), ev('cordoba-f', '코르도바 퓨처스', 'futures', 'clay'),
      ev('bordeaux-c', '보르도 챌린저', 'challenger', 'clay'), ev('prague-c', '프라하 챌린저', 'challenger', 'clay'),
      ev('estoril', '에스토릴 오픈', 't250', 'clay'), ev('munich', '뮌헨 오픈', 't250', 'clay'),
      ev('monte-carlo', '몬테카를로 마스터스', 'masters', 'clay'), ev('rome', '로마 마스터스', 'masters', 'clay'),
      ev('paris', '파리 메이저', 'major', 'clay'),
    ],
  },
  {
    name: '잔디 시즌',
    events: [
      ev('roehampton-jr', '로햄턴 주니어 그라스', 'jr', 'grass'), ev('london-jr', '런던 주니어 메이저', 'jrMajor', 'grass'),
      ev('nottingham-f', '노팅엄 퓨처스', 'futures', 'grass'), ev('gimcheon-f', '김천 퓨처스', 'futures', 'hard'),
      ev('ilkley-c', '일클리 챌린저', 'challenger', 'grass'), ev('seoul-c', '서울 챌린저', 'challenger', 'hard'),
      ev('halle', '할레 오픈', 't250', 'grass'), ev('stuttgart', '슈투트가르트 오픈', 't250', 'grass'),
      ev('london', '런던 메이저', 'major', 'grass'),
    ],
  },
  {
    name: '북미·아시아 하드 시즌',
    events: [
      ev('osaka-jr', '오사카 주니어 오픈', 'jr', 'hard'), ev('newyork-jr', '뉴욕 주니어 메이저', 'jrMajor', 'hard'),
      ev('tulsa-f', '털사 퓨처스', 'futures', 'hard'), ev('changwon-f', '창원 퓨처스', 'futures', 'hard'),
      ev('chicago-c', '시카고 챌린저', 'challenger', 'hard'), ev('shenzhen-c', '선전 챌린저', 'challenger', 'hard'),
      ev('seoul', '코리아 오픈', 't250', 'hard'), ev('tokyo', '도쿄 오픈', 't250', 'hard'),
      ev('toronto', '토론토 마스터스', 'masters', 'hard'), ev('shanghai', '상하이 마스터스', 'masters', 'hard'),
      ev('newyork', '뉴욕 메이저', 'major', 'hard'), ev('finals', '투어 파이널스', 'finals', 'hard'),
    ],
  },
];

export const pointsFor = (tier: JTier, roundsWon: number): number => JTIERS[tier].points[roundsWon]!;
export const roundsIn = (tier: JTier): number => Math.log2(JTIERS[tier].draw);
