// The M5 short-loop targets (ADR-016): design goals measured by `npm run quick`, not data.
export const QUICK_TARGETS = {
  /** Fast4 with No-Ad runs about 35 points (ADR-015). */
  medianPoints: { min: 28, max: 40 },
  /** Seconds on screen per match at the default pace, decisions aside. */
  medianSeconds: { min: 0, max: 90 },
  /** A one-card habit against the adaptive AI. */
  fixedCardWin: { min: 0, max: 0.45 },
  /** One card always, against an opponent playing any card. */
  cardVsRandom: { min: 0.45, max: 0.55 },
  /** Reading the AI perfectly. */
  exploitWin: { min: 0.6, max: 1 },
  aiEntropy: { min: 1.3, max: Math.log2(3) },
  /** Places climbed in 30 matches by a user who reads the AI half the time. */
  ladderClimb30: { min: 10, max: 25 },
} as const;
