# Proposals waiting for a decision

Design questions found while working autonomously (2026-10-14). Each one lists the options with a recommended
default; nothing here is built yet. Accepted proposals become ADRs in `decisions.md`.

## P1. Game plans that depend on the opponent (TD-031)

**Finding.** With random cards, an average player wins 53% on aggressive, 51% on balanced and 48% on defensive, and
aggressive leads against every AI style (`npm run quick`, row "Win % by plan"). The plan only sets the tactic's
aggression for points played without cards, and the engine rewards risk for average players at every level: across
aggression 0.2 → 0.8 the win rate rises from 47% to 53%. The other tactic fields don't reverse this either:
`targetBackhand` changes little and a fixed `serveTarget` costs points. Narrowing the plans (0.35 / 0.5 / 0.65 gives
49 / 50 / 52%) shrinks the gap but makes the choice meaningless, against the playtest's "my choice must matter".

**Options.**
- **A. The engine gives risk a best level per matchup.** Errors from aggression cost more against strong defenders
  (counter-punchers, high defence ratings), so aggressive pays against weak defenders and defensive pays against big
  hitters. This is closest to real tennis. But it is an engine change: the season balance (M4) and the M1 batch
  targets need a re-check, and the engine goldens change.
- **B. The plan carries into the big points (recommended).** Each plan also scales the user's card strengths at
  decision points. Aggressive: Attack ×1.15 and Defend/Counter ×0.9. Defensive: the reverse. Balanced: no change.
  The extra points that aggressive wins without cards are then paid back by weaker Defend and Counter when the
  opponent's habit calls for them. The effect is readable: the strength bars on the cards already show it. Needs a
  small engine input (a per-player card-strength multiplier in the match config, schema v6, ADR) and a new target:
  "plans within 3 pp overall, and each plan best against at least one AI style".
- **C. Narrow the aggression levels.** No engine change, but the plans barely matter.
- **D. Leave it** and say so on the plan line ("Aggressive: more winners, more errors").

**Default:** B, with the target above, measured by `planWinRates` (already in `game/src/quick/balance.ts`).
