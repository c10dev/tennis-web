// Public API of the game layer (ADR-011): career state and rules, headless and deterministic.
export { createPlayer, defaultAllocation, USER_ID, type Allocation, type CreatableStyle, type NewPlayer } from './player/create.ts';
export { CALENDAR, tournamentInWeek, type Tournament } from './calendar/schedule.ts';
export { pointsFor, TIERS, type Tier, type TierSpec } from './calendar/tiers.ts';
export { overall } from './player/overall.ts';
export { canPlay, endWeek, matchFatigue, type Focus, type Intensity, type WeekActivity } from './player/week.ts';
export { carryover, rankingOrder, rankingPoints } from './ranking.ts';
export { champion, nextPairs, playRound as playBracketRound, roundCount, roundsWon, startBracket, type Bracket } from './tournament/bracket.ts';
export { makeDraw, seedOrder } from './tournament/draw.ts';
export { entryList } from './tournament/entry.ts';
export { CREATION, EDITABLE, FOCUS_RATINGS, STYLES } from './tuning.ts';
export type { CareerPlayer, World } from './types.ts';
export { generateWorld } from './world/generate.ts';
export { aiChoice, aiTactic } from './season/ai.ts';
export { averageMetrics, seasonMetrics, SEASON_TARGETS, spearman, type SeasonMetrics } from './season/metrics.ts';
export { pendingUserMatch, playRound, quickRecipe, type PendingMatch } from './season/round.ts';
export { simulateSeason } from './season/run.ts';
export {
  currentRanking, newSeason, playerById, type MatchRecord, type SeasonState, type Standing, type TournamentRecord, type TournamentState, type UserChoice,
} from './season/state.ts';
export { beginWeek, closeWeek, seasonOver, weekPreview, type WeekPreview } from './season/week.ts';
