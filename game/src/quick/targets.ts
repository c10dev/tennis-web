// The M6 quick-match targets (ADR-017): design goals measured by `npm run quick`, not data.
// Flow (match length, decisions, pace, matchup weight, skill, ladder) and read (opponents) are owned by different
// workstreams; `null` marks a measure that workstream has not built yet.
export const QUICK_TARGETS = {
  flow: {
    medianPoints: { min: 10, max: 14 },
    medianDecisions: { min: 3, max: 5 },
    /** Share of matches with at least two decisions. */
    twoOrMoreDecisions: { min: 0.9, max: 1 },
    /** Seconds on screen per match, decisions aside. */
    medianSeconds: { min: 0, max: 60 },
    /** Point-win shift for a won matchup at a decision point, average players. */
    matchupEdge: { min: 0.2, max: 0.3 },
    ladderClimb30: { min: 10, max: 25 },
  },
  read: {
    /** Knows the opponent's habit, against equal ratings. */
    habitWin: { min: 0.65, max: 1 },
    tellWin: { min: 0.57, max: 1 },
    randomWin: { min: 0.45, max: 0.55 },
    /** One card always, across every opponent: no card may dominate. */
    fixedCardWin: { min: 0, max: 0.55 },
    /** How often an opponent plays its habit card when its habit applies. */
    habitShare: { min: 0.6, max: 0.75 },
  },
  result: {
    /** Won matches where a rating shown on the 0–100 scale goes up. */
    visibleGainOnWin: { min: 0.8, max: 1 },
    /** Matches with decisions where the result screen finds the decisive one. */
    decisiveFound: { min: 1, max: 1 },
  },
} as const;
