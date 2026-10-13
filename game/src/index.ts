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
export { pendingUserMatch, playOut, playRound, quickRecipe, type PendingMatch } from './season/round.ts';
export { simulateSeason } from './season/run.ts';
export {
  currentRanking, newSeason, playerById, type MatchRecord, type SeasonState, type Standing, type TournamentRecord, type TournamentState, type UserChoice,
} from './season/state.ts';
export { beginWeek, closeWeek, seasonOver, weekPreview, type WeekPreview } from './season/week.ts';
export { fromSave, SAVE_VERSION, toSave, type SaveFile, type SaveSummary } from './save/format.ts';
export { checkSlot, MemoryStore, SLOTS, type SaveStore, type Slot, type SlotSummary } from './save/store.ts';
export { fatigueLabel, money, ordinal, resultLabel, roundName, STYLE_LABEL, SURFACE_LABEL } from './views/format.ts';
export { homeView, type HomeView, type Option } from './views/home.ts';
export { playerView } from './views/player.ts';
export { rankingsView } from './views/rankings.ts';
export { savesView } from './views/saves.ts';
export { historyView, tournamentView, type MatchRow } from './views/tournament.ts';
export { aiCard, BEATEN_BY, CARDS, cardEntropy, cardOdds, type CardContext } from './quick/ai.ts';
export { finishQuick, ladderOrder, newLadder, nextOpponent, pointsToNext, rankOf, type QuickRecord, type QuickState } from './quick/ladder.ts';
export { matchOver, playPoint, startQuick, userRole, type QuickMatch } from './quick/match.ts';
export { cardReward } from './quick/rewards.ts';
export { fromQuickSave, QUICK_VERSION, toQuickSave, type QuickSave } from './quick/save.ts';
export { broadcastSeconds, clipFor, decisive } from './quick/pace.ts';
export { QUICK_PACE } from './tuning.ts';
export { cardChoices, pointSituation, quickHomeView, quickResultView, revealView } from './views/quick.ts';
