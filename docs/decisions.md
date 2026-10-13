# Decisions Log (ADR)

Format: one entry per decision, newest at the bottom.

## ADR-000: Template
- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Superseded by ADR-XXX
- **Context:** 
- **Decision:** 
- **Consequences:** 

## ADR-001: Headless deterministic engine separated from renderer
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** Need reproducible matches, testable stats, replayable broadcasts.
- **Decision:** `engine/` emits event data with seeded RNG; `renderer/` only consumes events.
- **Consequences:** Engine testable in Node; replays can be saved as JSON.

## ADR-002: M1 scope and toolchain
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** GDD §12 asks for clarifying questions before M1. The user accepted every proposed default.
- **Decision:**
  1. Point and shot outcomes are drawn from probabilities. Shot coordinates, speeds and times are generated afterwards to
     match the outcome (an `out` error lands outside the court). Geometry feeds back only through a position-quality term.
  2. All GDD attributes exist in the types. M1 formulas use serve, forehand, backhand, return, movement, agility,
     stamina, composure, aggression, consistency and decision. Volley, overhead, slice and drop shot wait for later.
  3. Attributes are stored as integers 1–20 and normalised to 0–1 inside the engine.
  4. Scoring supports best of 3 and 5, No-Ad, and the three final-set modes in M1.
  5. Hard, clay and grass all exist in M1, because the tuning targets are per surface.
  6. The reference "average tour player" has every attribute at 13. The big server has serve attributes at 17 or more.
  7. Batch runs are best of 3 and should finish 10,000 matches in about a minute on Node.
  8. M1 fills every `ShotEvent` field so the M2 renderer can use it directly.
  9. Dev dependencies only, pinned exactly: typescript 6.0.3, vitest and @vitest/coverage-v8 5.0.4, eslint 10.12.0,
     @eslint/js 10.0.1, typescript-eslint 8.71.2, tsx 4.23.15, @types/node 24.19.2. TypeScript stays on 6.0 because
     typescript-eslint 8.71 supports `<6.1`. Vite and Three.js arrive in M2. No Prettier.
  10. Code, ADRs and commits are in English; the GDD stays in Korean. No remote repository yet.
- **Consequences:** ESLint enforces CLAUDE.md rules 1 and 2 in `engine/src`: `Math.random`, `Date.now`, `new Date`,
  `performance`, DOM globals, Node built-ins and renderer/ui/three imports are errors. The engine's `lib` has no DOM.
