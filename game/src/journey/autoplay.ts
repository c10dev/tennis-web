// A player who always takes the first option and an automatic plan of one style (ADR-032): the balance batch and tests use it.
import { choose, currentChoice } from './events.ts';
import { advanceSwing } from './swing.ts';
import { autoPlan, type AutoStyle } from './plan.ts';
import type { Group } from './ratings.ts';
import type { JourneyState, SwingReport } from './types.ts';

export type Policy = (s: JourneyState, eventId: string) => string | null;

/** Answers every pending choice with `policy` (null: the first option). */
export function answerAll(s: JourneyState, policy?: Policy): JourneyState {
  let next = s;
  while (next.pending.length) {
    const eventId = next.pending[0]!.event;
    next = choose(next, policy?.(next, eventId) ?? firstOption(next)).state;
  }
  return next;
}

const firstOption = (s: JourneyState): string => currentChoice(s)!.options[0]!.id;

/** Plays swings until retirement (or `maxSwings`) with automatic plans of one style, answering choices on the way. */
export function playCareer(s: JourneyState, style: AutoStyle, focus: Group[], policy?: Policy, maxSwings = 120): { state: JourneyState; reports: SwingReport[]; swings: number } {
  let state = answerAll(s, policy);
  const reports: SwingReport[] = [];
  let swings = 0;
  while (state.user.stage !== 'retired' && swings < maxSwings) {
    const out = advanceSwing(state, autoPlan(state, style, focus, swings));
    reports.push(out.report);
    swings++;
    state = answerAll(out.state, policy);
  }
  return { state, reports, swings };
}
