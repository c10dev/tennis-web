// Quick-match screen sounds (TD-047, ADR-027): what the reveal, the count-ups and the result play, decided here as
// pure functions; the mixer only plays them. The reveal's stages follow ADR-021: face down, flip, verdict.
import { AUDIO } from '../tuning/index.ts';

export type Matchup = 'won' | 'lost' | 'even';

export type UiSound =
  | { kind: 'duck'; on: boolean }
  | { kind: 'clash' }
  | { kind: 'pop'; matchup: Matchup }
  | { kind: 'tick'; semitones: number }
  | { kind: 'sting'; won: boolean };

/** `abort` is a reveal cut short (the screen went away while the crowd was ducked). */
export type RevealStage = 'facedown' | 'flip' | 'verdict' | 'abort';

/** The crowd hushes while the cards lie face down; the flip lifts it with a clash; the verdict pops. */
export function revealSounds(stage: RevealStage, matchup: Matchup): UiSound[] {
  switch (stage) {
    case 'facedown':
      return [{ kind: 'duck', on: true }];
    case 'flip':
      return [{ kind: 'duck', on: false }, { kind: 'clash' }];
    case 'verdict':
      return [{ kind: 'pop', matchup }];
    case 'abort':
      return [{ kind: 'duck', on: false }];
  }
}

/** The numbers a count-up from `from` to `to` ticks on: every number when short, at most `max` spread evenly. */
export function tickThresholds(from: number, to: number, max: number = AUDIO.ui.maxTicks): number[] {
  const range = Math.abs(to - from);
  const n = Math.min(max, range);
  const sign = Math.sign(to - from);
  return Array.from({ length: n }, (_, k) => from + sign * Math.ceil((range * (k + 1)) / n));
}

/** For a count-up's formatter: given each shown number, a tick when it reaches the next step (one per call, rising). */
export function createTicker(from: number, to: number): (shown: number) => UiSound | null {
  const steps = tickThresholds(from, to);
  const sign = Math.sign(to - from);
  let next = 0;
  return (shown) => {
    let reached = next;
    while (reached < steps.length && sign * (shown - steps[reached]!) >= 0) reached++;
    if (reached === next) return null;
    const semitones = Math.min(AUDIO.ui.maxSemitones, next * AUDIO.ui.semitoneStep);
    next = reached;
    return { kind: 'tick', semitones };
  };
}

/** The result screen's stinger, as the headline shows. */
export const resultSounds = (won: boolean): UiSound[] => [{ kind: 'sting', won }];
