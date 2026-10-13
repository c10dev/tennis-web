// Public API of the game layer (ADR-011): career state and rules, headless and deterministic.
export { createPlayer, defaultAllocation, USER_ID, type Allocation, type CreatableStyle, type NewPlayer } from './player/create.ts';
export { CALENDAR, tournamentInWeek, type Tournament } from './calendar/schedule.ts';
export { pointsFor, TIERS, type Tier, type TierSpec } from './calendar/tiers.ts';
export { overall } from './player/overall.ts';
export { carryover, rankingOrder, rankingPoints } from './ranking.ts';
export { champion, nextPairs, playRound, roundCount, roundsWon, startBracket, type Bracket } from './tournament/bracket.ts';
export { makeDraw, seedOrder } from './tournament/draw.ts';
export { entryList } from './tournament/entry.ts';
export { CREATION, EDITABLE, STYLES } from './tuning.ts';
export type { CareerPlayer, World } from './types.ts';
export { generateWorld } from './world/generate.ts';
