// Tuning for the text career (ADR-032). Measured values say when and how they were measured.

/** The fast model for AI-vs-AI matches, fitted to engine batches on 2026-10-18 (players near overall 8–17). */
export const FAST = {
  /** Serve points won between two players at `pivot` on hard. */
  serve: 0.643,
  pivot: 14,
  /** Per point of the two players' mean level: better players hold more. */
  perLevel: 0.0102,
  /** Per point of the server's level over the returner's. */
  perGap: 0.0225,
  surface: { hard: 0, clay: -0.012, grass: 0.013 },
  /** Level per point of surface affinity above 13 (8 points of affinity moved serve points as 0.64 of overall). */
  affinity: 0.08,
  /** Level lost to starting fatigue: at most `fatigueCap` (0.3 cost 0.5 of a level, 0.6 cost 0.6). */
  fatigue: 1.7,
  fatigueCap: 0.6,
} as const;
