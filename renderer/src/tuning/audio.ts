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
  volume: { master: 0.8, sfx: 0.9, crowd: 0.6, umpire: 0.9 },
} as const;
