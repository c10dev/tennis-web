// Public API of the text career (ADR-032).
export { answerAll, playCareer, type Policy } from './autoplay.ts';
export { eventById, JTIERS, SWING_WEEKS, SWINGS, weeksOf, type JEvent, type JTierSpec, type Region, type Swing } from './calendar.ts';
export { autoPlan, validatePlan, type AutoStyle, type Plan } from './plan.ts';
export { fatigueForecast, forecast, type EventForecast, type FatigueForecast } from './forecast.ts';
export type { Entry } from './entry.ts';
export { agency, care, coaching, COACH_GROUPS, market, ROLES, salaryOf, type CoachStyle, type Hired, type Role, type Staff, type Team } from './staff.ts';
export { commentary, type Line as CommentaryLine, type LineKind } from './commentary.ts';
export { choose, context as careerContext, currentChoice, queueChoices, type ChoiceView } from './events.ts';
export { calendarYear } from './events-stage.ts';
export { reached, shortName, TIER_LABEL } from './facts.ts';
export { NATIONS } from './names.ts';
export { press, type Comment, type Headline, type Press } from './news.ts';
export { rankOf as journeyRankOf, total as rankingTotal } from './ranking.ts';
export { checkTalents, createPro, GROUPS, groupValues, ovr, talentsUsed, type CreatableStyle as JourneyStyle, type Group, type ProInput, type ProShape, type Talents } from './ratings.ts';
export { fromJourneySave, JOURNEY_VERSION, sortHall, toJourneySave, type HallEntry, type JourneySave } from './save.ts';
export { emptyStats, newJourney, USER as JOURNEY_USER, type Start } from './start.ts';
export { grade, summarize, type CareerSummary } from './summary.ts';
export { advanceSwing, type SwingOutcome } from './swing.ts';
export type {
  CareerStats, EventResult, Hand, JourneyState, JPlayer, JTier, MatchLine, Nation, PendingChoice, Stage, SwingReport, UserState,
} from './types.ts';
