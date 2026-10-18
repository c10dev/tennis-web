// A player who always takes the first option and a fixed plan (ADR-032): the balance batch and tests use it.
import { choose, currentChoice } from './events.ts';
import { advanceSwing } from './swing.ts';
import type { JourneyState, Plan, SwingReport } from './types.ts';

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

/** Plays swings until retirement (or `maxSwings`), answering choices on the way. */
export function playCareer(s: JourneyState, plan: Plan, policy?: Policy, maxSwings = 120): { state: JourneyState; reports: SwingReport[]; swings: number } {
  let state = answerAll(s, policy);
  const reports: SwingReport[] = [];
  let swings = 0;
  while (state.user.stage !== 'retired' && swings < maxSwings) {
    const out = advanceSwing(state, plan);
    reports.push(out.report);
    swings++;
    state = answerAll(out.state, policy);
  }
  return { state, reports, swings };
}
