// Sound: when cues fire relative to the events, and how loud things are (GDD §8.4).

export const AUDIO = {
  /** A clock step longer than this (or backwards) is a seek: no cues for it. */
  maxCueGapSec: 1.05,
  /** Above this speed only the ball is heard: no umpire, no crowd. */
  maxSpeedForVoices: 2,
  /** Delays after the moment they react to. */
  callDelaySec: 0.3,
  scoreCallDelaySec: 0.3,
  crowdDelaySec: 0.15,
  /** Crowd reaction 0–1: by how the point ended, plus rally length and the point's importance. */
  crowd: {
    ace: 0.55, winner: 0.65, error: 0.3, doubleFault: 0.2,
    perRallyShot: 0.02, rallyMax: 0.25,
    break_point: 0.12, set_point: 0.2, match_point: 0.3, tiebreak: 0.08, gameWon: 0.1,
  },
  volume: { master: 0.8, sfx: 0.9, crowd: 0.6, umpire: 0.9, ui: 0.7 },
  /** Quick-screen UI sounds (ADR-029): short synthesised blips, a swish, a clash chord, rising count-up ticks, a stamp.
   *  Frequencies in Hz, times in seconds, peaks as gain before the ui bus. */
  ui: {
    maxSec: 0.6,
    peakMax: 0.5,
    /** The three cards dealing up: triangle blips, each a few semitones above the last. */
    deal: { freq: 880, stepSemitones: 3, peak: 0.12, decay: 0.05 },
    pick: { freq: 660, peak: 0.16, decay: 0.08 },
    /** Face down: a low hum while the crowd ducks to `duck` of its level for `sec`. */
    hold: { freq: 110, peak: 0.08, decay: 0.45, duck: 0.25, sec: 0.5 },
    flip: { freq: 2400, q: 0.8, peak: 0.25, decay: 0.12 },
    /** The verdict: a thump, then a chord that climbs on a win, sits on a draw, falls on a loss. */
    clash: {
      won: [523.25, 659.25, 783.99, 1046.5], even: [587.33, 587.33], lost: [392, 329.63],
      stepSec: 0.06, peak: 0.2, decay: 0.18, thump: { freq: 300, q: 0.9, peak: 0.35, decay: 0.12 },
    },
    /** Count-up ticks climb up to an octave over the count (a loss walks down a fifth); closer ticks are dropped. */
    tick: { base: 659.25, maxSemitones: 12, downSemitones: 7, minGapSec: 0.045, peak: 0.1, decay: 0.04 },
    rise: { notes: [783.99, 1174.66], stepSec: 0.07, peak: 0.14, decay: 0.12 },
    stamp: { freq: 140, peak: 0.4, decay: 0.16, noise: { freq: 900, q: 0.7, peak: 0.25, decay: 0.1 } },
  },
} as const;
