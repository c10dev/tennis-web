// The 24-week season (GDD §9.4): one tournament a week at most; surfaces run hard → clay → grass → hard.
import type { Surface } from '@tennis/engine';
import type { Tier } from './tiers.ts';

export interface Tournament {
  id: string;
  name: string;
  week: number;
  tier: Tier;
  surface: Surface;
}

const t = (week: number, tier: Tier, surface: Surface, name: string): Tournament => ({ id: `w${String(week).padStart(2, '0')}`, name, week, tier, surface });

export const CALENDAR = {
  weeks: 24,
  tournaments: [
    t(1, 't250', 'hard', 'Harbour Open'),
    t(2, 'challenger', 'hard', 'Coastline Challenger'),
    t(3, 'major', 'hard', 'Southern Major'),
    t(5, 't250', 'hard', 'Desert Classic'),
    t(6, 'masters', 'hard', 'Palm Masters'),
    t(8, 'challenger', 'clay', 'Valley Challenger'),
    t(9, 't250', 'clay', 'Riviera Open'),
    t(10, 'masters', 'clay', 'Capital Masters'),
    t(12, 'major', 'clay', 'Red Earth Major'),
    t(14, 'challenger', 'grass', 'Meadow Challenger'),
    t(15, 't250', 'grass', 'Lawn Classic'),
    t(18, 'masters', 'hard', 'Lakeside Masters'),
    t(19, 't250', 'hard', 'Metro Open'),
    t(21, 'challenger', 'hard', 'Autumn Challenger'),
  ] as readonly Tournament[],
} as const;

export const tournamentInWeek = (week: number): Tournament | null => CALENDAR.tournaments.find((x) => x.week === week) ?? null;
