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

## ADR-003: Scoring state machine semantics
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** GDD §6 leaves a few rule details open, and the event stream must say when players change ends.
- **Decision:**
  - `ScoreState.points` holds raw point counts; `scoring/format.ts` turns them into 15/30/40/AD for display.
  - A `changeover` event means the players change ends: after odd games of a set, after a set with an odd number of
    games (a tiebreak counts as a game), and every six points of a tiebreak. It is not emitted after the last point of
    the match.
  - Final-set mode `tiebreak10` is a 10-point tiebreak at 6-6 in the final set (the Grand Slam rule). A match
    tiebreak that replaces the whole final set is not implemented.
  - The player who received first in a tiebreak serves the first game of the next set. A tiebreak game is never a
    break (`isBreak: false`).
  - Point tags are found by trying both outcomes of the next point: `break_point` when the receiver would win the
    game, `set_point` / `match_point` when either player would win the set or match.
- **Consequences:** Scoring is one pure function, `applyPoint(state, winner)`, with 100% line and branch coverage
  enforced by the coverage threshold on `engine/src/scoring`.

## ADR-004: Point model, outcome labels and statistics definitions
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** GDD §5 gives the shape of the probability model; the tuning targets in §10 need exact definitions.
- **Decision:**
  - Probabilities are written in `tuning.ts` as the rate for two average players (all ratings 13) on hard court, and
    skill differences shift them on the logit scale. The rally error rate follows GDD §5.2 literally:
    `base(risk) × (1 − skill) × difficulty × fatigue × pressure × surface`.
  - Shot selection draws a risk level (safe / neutral / aggressive) and a target (opponent forehand / backhand /
    middle). GDD's cross / line / middle directions are not modelled separately in M1. All players are right-handed.
  - Outcomes: a serve is `fault`, `double_fault`, `ace` or `in`. A rally shot is `in`, `winner`, `forced_error` or
    `unforced_error`; an error is forced when the incoming ball's quality is above `RALLY.forcedThreshold`. Whether an
    error went into the net or out is visible only in the geometry (`netClearance < 0` with no bounce, or a bounce
    outside the court). The `net` outcome is not emitted in M1.
  - Rally length counts shots that went in, the serve included: an ace is 1, a double fault 0, an unreturned serve 1.
  - Stats: winners exclude aces; first-serve % is points played on the first serve over service points; break
    points are counted for the receiver as `converted/opportunities`.
  - The match JSON is `MatchResult { schemaVersion: 1, seed, config, events, winner, stats }`.
- **Consequences:** Geometry is consistent with the outcome but never decides it, so M2 can change how shots look
  without changing results. A full best-of-3 match JSON is about 0.7 MB.

## ADR-005: M1 tuning and skill sensitivity
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** The first tuning met the GDD table, but a player rated one point higher in every attribute (14 against
  13) won 98.8% of best-of-3 matches. GDD's literal `(1 − skill)` term cuts errors by about 14% per rating point.
  The GDD only asks that win rate rises with the gap, but a management game needs a one-point edge to matter without
  deciding the match.
- **Decision:** The `(1 − skill)` term uses an effective skill `AVG + errorSkill × (skill − AVG)` with
  `errorSkill = 0.15`, and the other skill slopes in `tuning.ts` were lowered to match. Average-player rates are
  unchanged, because every slope multiplies `(skill − AVG)`.
- **Consequences:** `npm run sim -- --n 10000 --seed 42`:

  | Metric | Hard | Clay | Grass | Target |
  |---|---|---|---|---|
  | Hold % | 78.8 | 76.5 | 81.2 | 75–85 / 70–80 / 80–90 |
  | Aces / service game | 0.61 | 0.47 | 0.72 | 0.3–0.8 |
  | Double faults / service game | 0.27 | 0.27 | 0.26 | 0.15–0.35 |
  | 1st serve in % | 61.5 | 61.4 | 61.5 | 58–68 |
  | 1st serve points won % | 70.8 | 69.2 | 72.6 | 68–78 |
  | 2nd serve points won % | 49.6 | 49.1 | 50.3 | 48–56 |
  | Average rally | 4.37 | 4.58 | 4.13 | 3.5–5.5, clay longest |
  | Rallies ≤ 4 shots % | 64.0 | 62.1 | 66.3 | 60–75 |
  | Sets with a tiebreak % | 20.8 | 19.3 | 23.1 | 10–25 |

  Big server (serve 18/17/15): 1.27 aces per service game, wins 78.4% against an average player.
  Rating ladder against 13 (4,000 matches each): 11 → 10.1%, 12 → 26.7%, 13 → 50.2%, 14 → 73.8%, 15 → 90.0%.
  `npm run test:stats` guards these with 1,000-match runs and slightly wider ranges.

## ADR-006: Event schema v2 and match fingerprints
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** The M2 replay has to know when each ball lands. In v1 that time could only be recovered from private
  constants of `simulatePoint` (0.45 s from bounce to contact, 0.8 s after the last flight), and never for a fault,
  because the second serve follows after a fixed gap. TD-005 also asks for a way to check that a browser replays a seed
  exactly as Node does.
- **Decision:**
  - `ShotEvent.flightSec` (seconds from contact to the first bounce, or to the net) is added and `SCHEMA_VERSION`
    becomes 2. The value was already computed by `geometry.flightSec` and draws no random numbers.
  - `fingerprint(result)` is FNV-1a 32-bit over the UTF-16 code units of `JSON.stringify(result.events)`, as 8 hex
    digits. `JSON.stringify` prints numbers by the same shortest round-trip rule in every engine, so equal hashes mean
    equal events.
  - `exhibitionConfig(surface)` (big server Flint against the average Rook) is the match both the CLI
    (`npm run sim -- --fingerprint --seed 42 --surface clay`) and the replay page use, so their hashes can be compared.
  - `COURT` is exported from the engine index for the renderer. This is not a schema change.
- **Consequences:** 10,000-match batch reports on all three surfaces are byte-identical before and after the change.
  v1 replay JSON is rejected by the renderer rather than migrated: nothing has stored v1 files. The golden fingerprint
  for clay seed 42 is `4c42dc1d`; any change to the event stream must update it on purpose.
