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
  /** Quick-match screen sounds (TD-047, ADR-027): the reveal's crowd duck, clash and verdict pop, count-up ticks. */
  ui: {
    /** The crowd drops this far while the cards lie face down: down in duckSec, back over restoreSec. */
    duckDb: -9, duckSec: 0.08, restoreSec: 0.3,
    /** A count-up ticks at most this often, a semitone higher each tick, never above maxSemitones. */
    maxTicks: 12, semitoneStep: 1, maxSemitones: 12, tickHz: 660, tickGain: 0.18,
    popHz: { won: 880, even: 550, lost: 330 }, popGain: 0.3,
    clashGain: 0.7,
    /** The synthesised stinger used until the generated one has loaded: three notes, rising for a win. */
    stingHz: { won: [523, 659, 784], lost: [392, 330, 262] }, stingNoteSec: 0.14, stingGain: 0.25,
  },
  /** Generated samples (TD-016, docs/sound/manifest.json) and how cues map onto them. */
  samples: {
    /** Crowd intensity at which the applause turns loud, and at which a cheer goes on top. */
    bigApplauseAt: 0.5, cheerAt: 0.8,
    /** Grass reuses the hard-court bounce, lower and softer. */
    grassRate: 0.85, grassGain: 0.75,
    /** Ball speed (km/h) for full power; rate spans ±rateSpread/2 with power, plus ±jitter from shot to shot. */
    fullPowerKmh: 200, rateSpread: 0.12, jitter: 0.03,
    replayGain: 0.6,
    /** The crowd bed loops this far inside each end of its file, clear of codec padding. */
    loopInsetSec: 0.05,
    /** Seconds over which the synthesised bed hands over to the sample bed once it has loaded. */
    bedFadeSec: 1.5,
  },
} as const;
