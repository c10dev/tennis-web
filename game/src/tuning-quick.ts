// Quick-match tuning (ADR-016, ADR-017): card AI, ladder, pace, tiebreak format, decision points, game plans, opponent
// personas and rewards. Re-exported by tuning.ts; import from there.

/** The quick-match card AI (ADR-016): a style's habits, a read of the user's habits, and some unpredictability. */
export const QUICK_AI = {
  /** Base card weights by style and role (attack, defend, counter). */
  base: {
    big_server: { serve: [0.6, 0.15, 0.25], return: [0.45, 0.25, 0.3] },
    baseliner: { serve: [0.25, 0.5, 0.25], return: [0.25, 0.5, 0.25] },
    counter_puncher: { serve: [0.2, 0.3, 0.5], return: [0.15, 0.3, 0.55] },
    serve_and_volley: { serve: [0.6, 0.15, 0.25], return: [0.45, 0.25, 0.3] },
    all_court: { serve: [0.4, 0.3, 0.3], return: [0.3, 0.3, 0.4] },
  },
  /** How many of the user's recent cards (in the same role) the AI looks at, and how often it acts on a read. */
  window: 6,
  adapt: 0.15,
  /** No card is played more often than this: the mix is pulled towards even until it holds (≥ 1.3 bits). */
  maxShare: 0.6,
  /** A read only counts when one card is clearly the habit: its share above an even third, scaled to 0–1. */
  habitFloor: 1 / 3,
  /** Attack weight falls by this share per unit of fatigue. */
  fatigueAttack: 0.5,
} as const;

/** The quick-match ladder and its rewards (ADR-016). */
/** Quick matches are one Fast4 set with No-Ad (ADR-015). */
export const FAST4_RULES = { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'fast4' } as const;

export const QUICK = {
  /** Ladder points by starting rank: top × exp(−(rank − 1) / scale). */
  startTop: 1600,
  startScale: 16,
  /** A win pays win + perRankAbove for every place the opponent was above; a loss costs `loss`. */
  win: 20,
  perRankAbove: 4,
  loss: 6,
  /** AI matches played around the ladder after each of the user's matches. */
  background: 6,
  /** Rating progress per card played, on the ratings behind it; a win pays winXp times as much. */
  xpPerCard: 0.008,
  winXp: 1.5,
  rewardStats: {
    attack: ['servePower', 'forehand', 'aggression'],
    defend: ['consistency', 'movement'],
    counter: ['return', 'decision', 'agility'],
  },
  surfaces: ['hard', 'clay', 'grass'],
} as const;

/** How a quick match is shown (ADR-017). A point without cards: its last `autoClipSec` in 3D at `autoSpeed`, then a
 *  ticker beat of `autoSec` (fast mode: the beat only). A decision point: the card reveal, the whole point (its last
 *  `keyMaxSec` at most) at `speed`, and the score. The UI plays exactly these windows; the balance report adds them up. */
export const QUICK_PACE = {
  autoSec: 0.35,
  autoClipSec: 1.6,
  autoSpeed: 3,
  /** The reveal (ADR-021): the picked card lifts, both cards lie face down, flip at the same instant, and the verdict
   *  pops this long after the flip. The UI plays these; revealSec is their sum (the screen-time model uses it). */
  reveal: { selectSec: 0.15, holdSec: 0.5, flipSec: 0.28, verdictSec: 0.15 },
  revealSec: 1.08,
  scoreSec: 0.6,
  speed: 2,
  /** The serve toss before contact (renderer PLAYBACK.tossLeadSec). */
  tossSec: 1,
  /** Even a decision point shows at most its last this-many seconds (a long point with a second serve runs 20 s+). */
  keyMaxSec: 8,
} as const;

// ---- M6 (ADR-017). Each block belongs to one workstream: flow (TIEBREAK_RULES, QUICK_MOMENTS, QUICK_PLAN),
// opponent read (QUICK_PERSONA), result (QUICK_REWARD). Change only your own block.

/** A quick match is one tiebreak to seven, two clear. */
export const TIEBREAK_RULES = { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } as const;

/** Where a quick match stops for cards: once either player has this many points, and at any set or match point.
 *  Over 4,000 tiebreaks of average players: median 3 decisions, at least 2 in every match (5-all gave median 2). */
export const QUICK_MOMENTS = {
  fromPoints: 5,
  /** No more stops after this many decisions: a marathon tiebreak plays on (the playtest's fatigue, TD-030). */
  maxDecisions: 6,
} as const;

/** The user's game plan as the tactic for the points played without cards. */
export const QUICK_PLAN = {
  aggressive: { aggression: 0.8 },
  balanced: { aggression: 0.5 },
  defensive: { aggression: 0.2 },
} as const;

/** Opponent personas, tells and rival memory. */
export const QUICK_PERSONA = {
  /** Chance the tell points at the card the opponent really plays. */
  tellAccuracy: 0.6,
  /** Chance the opponent plays its habit card when its habit applies (the rest follows its style mix). */
  habitShare: 0.72,
  /** A rival record keeps the opponent's cards at this many latest decision points. */
  rivalSeen: 12,
} as const;

/** The result screen's rewards: ratings shown on a 0–100 scale; a win lifts one rating to its next whole number. */
export const QUICK_REWARD = {
  /** Shown rating = floor((rating + progress) × displayScale): 1–20 becomes 5–100. */
  displayScale: 5,
  /** A loss moves the nearest rating behind the decisive card by at most this (half a shown point): it rises a whole
   *  number when that close, otherwise creeps on. A win always takes it to the next whole number. */
  lossStep: 0.1,
  /** On a win without a decision, the cards whose ratings the game plan trains. */
  planCards: { aggressive: ['attack'], balanced: ['attack', 'defend', 'counter'], defensive: ['defend'] },
  /** Ladder goals shown after a match: the first one above the user's rank (1 is "#1"). */
  milestones: [50, 32, 16, 8, 1],
  /** Wins are estimated against the opponent this many places above (the next opponent is one of the three above). */
  placesAbove: 2,
  /** Estimates stop here. */
  maxWins: 50,
  /** The result screen's reveal: play-by-play lines, pauses between steps, the points count-up (ease-out), the replay
   *  speed; ADR-021: tiles, names and ratings rise staggerSec apart, a rating that rose ticks up over tickSec, and the
   *  goal locks in lockSec after it shows. */
  reveal: { lineSec: 0.25, holdSec: 0.6, stepSec: 0.45, countSec: 1, replaySpeed: 1.25, staggerSec: 0.12, tickSec: 0.25, lockSec: 0.2 },
} as const;

/** Win streaks (proposal P3, option A): shown, never paid; a stamp when a streak reaches one of these. */
export const QUICK_STREAK = { milestones: [3, 5, 10] } as const;
