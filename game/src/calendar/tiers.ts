// Tournament tiers (GDD §9.4): draw size, match format and ranking points by rounds won (index = rounds won).
export type Tier = 'major' | 'masters' | 't250' | 'challenger';

export interface TierSpec {
  label: string;
  draw: number;
  bestOf: 3 | 5;
  /** points[r] for a player who won r rounds; the last entry is the champion's. Modelled on the ATP scale. */
  points: readonly number[];
  /** Prize money per ranking point, in dollars (shown only; finances come later). */
  prizePerPoint: number;
}

export const TIERS: Record<Tier, TierSpec> = {
  major: { label: 'Major', draw: 64, bestOf: 5, points: [45, 90, 180, 360, 720, 1200, 2000], prizePerPoint: 1500 },
  masters: { label: 'Masters', draw: 32, bestOf: 3, points: [45, 90, 180, 360, 600, 1000], prizePerPoint: 900 },
  t250: { label: '250', draw: 32, bestOf: 3, points: [5, 20, 45, 90, 150, 250], prizePerPoint: 600 },
  challenger: { label: 'Challenger', draw: 16, bestOf: 3, points: [8, 18, 35, 60, 100], prizePerPoint: 400 },
};

export const pointsFor = (tier: Tier, roundsWon: number): number => TIERS[tier].points[roundsWon]!;
