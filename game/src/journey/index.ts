// Public API of the text career (ADR-032).
export { answerAll, playCareer, type Policy } from './autoplay.ts';
export { JTIERS, SWINGS, type JEvent, type JTierSpec, type Swing } from './calendar.ts';
export { commentary, type Line as CommentaryLine, type LineKind } from './commentary.ts';
export { choose, context as careerContext, currentChoice, queueChoices, type ChoiceView } from './events.ts';
export { calendarYear } from './events-stage.ts';
export { reached, shortName, TIER_LABEL } from './facts.ts';
export { NATIONS } from './names.ts';
export { press, type Comment, type Headline, type Press } from './news.ts';
export { rankOf as journeyRankOf, total as rankingTotal } from './ranking.ts';
export { candidates, GROUPS, groupValues, ovr, type CandidateInput, type CreatableStyle as JourneyStyle, type Group } from './ratings.ts';
export { fromJourneySave, JOURNEY_VERSION, sortHall, toJourneySave, type HallEntry, type JourneySave } from './save.ts';
export { emptyStats, newJourney, USER as JOURNEY_USER, type Start } from './start.ts';
export { grade, summarize, type CareerSummary } from './summary.ts';
export { advanceSwing, type SwingOutcome } from './swing.ts';
export type {
  CareerStats, EventResult, Hand, JourneyState, JPlayer, JTier, Load, MatchLine, Nation, PendingChoice, Plan, Stage, SwingReport, UserState,
} from './types.ts';
