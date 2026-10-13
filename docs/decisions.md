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
     *(2026-10-13: that term was never implemented; no outcome reads a position. See ADR-008.)*
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

## ADR-007: M2 replay architecture
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** GDD §10 M2 asks for a Three.js court per surface, capsule players, ball arcs with bounces, a main
  camera, a basic score bug and play / pause / speed. The user accepted every default in the M2 clarification round
  and chose primitive players with code-driven swings (option b).
- **Decision:**
  - Packages: `@tennis/renderer` (playback logic, Three.js scene, camera, overlays) and `ui/` (the Vite dev page).
    Both import the engine only through `@tennis/engine`; the renderer never imports `ui/`. ESLint enforces this.
    Pinned: vite 8.3.4 (the copy vitest already used), three 0.186.1, @types/three 0.186.0.
  - Playback is pure: `buildTimeline(result)` lays the match on one clock, `frameAt(timeline, t)` returns ball, poses
    and score bug as plain data, and `clockReducer` handles play, pause, 0.25–4x, seek and point jumps. Seek and speed
    are just a different `t`. All of it, plus the Three scene graph (`createStage().applyFrame`), is tested in Node;
    only `viewer.ts` (WebGLRenderer), `scoreBugDom.ts` and `ui/` need a browser.
  - `Frame` is in engine coordinates. `scene/coords.ts` alone maps them to Three: (x, y, z) → (x, z, −y).
  - Pauses are compressed: 2.5 s between points, 6 s at a changeover, 8 s after a set, 3 s hold at the end, and a
    1 s toss before each serve. Renderer constants live in `renderer/src/tuning.ts`; they cannot change results.
  - Ball: the flight height is a quadratic through contact height, net clearance and the bounce, flattened to a
    line when it would bend upwards (never in 4,381 sampled shots). The next contact follows under gravity. Balls
    that end a rally hop once at a per-surface height; net balls drop in front of the tape.
  - Players: positions eased between the per-shot positions in the events; walks to the next point's start in the
    pause; a cut at a change of ends. `PlayerRig` (`apply(pose)`) is the swap point: M2 ships `CapsuleRig`, M3 can add
    a skinned GLTF rig without touching playback.
  - Main Cam: fixed behind the A starting end (it does not swap at changeovers) and pans gently with the ball.
- **Consequences:** Replays play from engine output or from saved JSON alone (GDD §3); v1 JSON is rejected. The
  fingerprints shown in Chromium matched the Node CLI for clay 42, grass 7, hard 123 and a loaded clay 99 file
  (TD-005). The production bundle is one ~600 kB chunk, mostly Three.js.

## ADR-008: Realistic contact geometry without touching results
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** The M2 replay showed players running up to 14.9 m/s (TD-006) and balls stalling after the bounce
  (TD-011): contact was placed 1.5–3.5 m past the bounce, 0.45 s later, whatever the ball's speed. Hawk-Eye (M3) also
  needs balls that land near lines, which the landing ranges never produced (good balls stopped 10–30 cm inside,
  misses started 5 cm outside).
- **Decision:**
  - A ball is met on its incoming line past the bounce (`point/chase.ts`), at a distance its post-bounce speed
    covers in 0.25–0.9 s (`GEOMETRY.bounceRetain`: hard 0.62, clay 0.55, grass 0.7 of the ground speed). The player
    prefers their own depth, stepped in or back; returns are struck around the baseline. If that spot cannot be
    reached at 5.5 m/s from the last recorded position, the nearest reachable point on the line is used, and failing
    that the player lunges as far as they can. Recovery after a shot is limited the same way. Players stay within
    4.5 m of the singles court's lines.
  - Good serves may land on the lines (x up to 4.115, depth up to 6.40) and good rally balls up to the baseline and
    sidelines; misses start 5 mm outside.
  - Every RNG draw keeps its place: `chase` draws two numbers like the old `chasePosition`, `contactPoint` three, and no
    branch skips or adds a draw. `engine/tests/outcome-golden.test.ts`, pinned on the old code, hashes 24 matches
    without positions and times but with speeds, spins and net clearances, and still passes.
  - The renderer eases moves with a trapezoid speed profile (peak 1.25× the average, smoothstep's is 1.5×) and walks
    players round the net post on the umpire's side at a change of ends, in separate lanes. Changeover and set-end
    pauses grow to 8 s and 10 s to leave time for the walk.
- **Consequences:** 10,000-match reports on hard, clay and grass, the rating ladder and the big-server run are
  byte-identical before and after. Rendered running speed over 20 matches: p50 0.49, p90 3.34, p99 5.06, max 6.88 m/s
  (was max 14.9). The fingerprint golden for clay seed 42 is now `d351eb07`. Replay JSON written before and after this
  change is equally valid v2: same fields, different positions and times.

## ADR-009: M3 broadcast architecture
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** GDD §10 M3 asks for a multi-camera director, replays, stats graphics, crowd and ball sound, better
  player animation and highlight modes. The user accepted every default in the M3 clarification round.
- **Decision:**
  - **Programme.** `buildProgramme(timeline, mode)` turns the match into clips: an intro, live clips cut wherever
    the camera changes, replay and Hawk-Eye inserts in the pause after a point, or one result clip. Each clip maps
    programme time to match time (`matchFrom`, `rate`: 1 live, 0.5 replay, 0 for stills) and may pin the score bug to
    another moment (`scoreTime`, so a replay shows the score after the point). `broadcastFrameAt` adds camera, clip
    and Hawk-Eye call to `matchFrameAt`. The clock plays anything with `totalSec` and `pointStarts`, so seek, speed
    and point jumps work in every mode.
  - **Director.** `cameraTrack` lays rules over the match from event tags only: Main by default; Side while players
    change ends; Reaction (point winner) for 2 s after aces, winners and break/set/match points; Serve Cam from the
    end of the previous pause to just after contact before big points and the first point of each game.
  - **Viewing modes.** Key points: break/set/match points, tiebreak points and points that end a game. Highlights:
    those, whole break games, rallies of 10+ and winners after 5+ shots.
  - **Replays and Hawk-Eye.** Winners after 5+ shots, 10+ shot rallies, converted big points and close calls are
    replayed: the last 3 s at half speed from the side, tracking the ball. `lineCall` measures the last bounce
    against the service box or singles court (lines in); within 5 cm a still close-up of the mark follows. The call
    always agrees with the engine's in/out. Players cannot challenge (needs engine rules).
  - **Graphics.** `overlayAt` derives serve speed, rally count, BREAK/SET/MATCH POINT and TIEBREAK captions (naming
    who has the chance), the player introduction, REPLAY, the Hawk-Eye call and set/match stats (`computeStats` over
    that set's points). DOM writers only use `textContent`.
  - **Sound.** `allCues` puts hits, bounces, net cords, crowd reactions (by outcome, rally length and importance)
    and umpire calls on the programme clock; `cuesBetween` hands each out once, drops voices above 2x and everything
    on a seek; replays get the ball only. The mixer synthesises every sound with Web Audio (no files, four buses);
    the umpire speaks through `speechSynthesis`. Sound starts off until the user turns it on.
  - **Players.** `MannequinRig` (hips, two-segment legs, torso, head and cap, racket arm, tossing arm) draws gait,
    crouch, split step and toss signals added to `PlayerPose`. A skinned GLTF rig can still replace it behind
    `PlayerRig`.
  - **Venue.** Stepped stands, ad boards and an umpire chair; `standHeightAt` keeps cameras above the stands.
  - **Browser tests.** `npm run test:e2e` (Playwright 1.64.0, Chromium) checks fingerprints against the engine run
    in Node, playback, all five cameras, modes, JSON loading and sound.
- **Consequences:** Renderer tuning is split into `tuning/{playback,scene,camera,broadcast,overlay,audio}.ts`.
  Clay seed 42: the match timeline is 33:26 (M2: 32:23, the difference is ADR-008's longer pauses and new contact
  times); the full programme adds 7:12 of replays, 10 s of Hawk-Eye and the 4 s intro, 40:52 in all. Key points run
  12:05, highlights 31:45, result 12 s.

## ADR-010: Matches played in steps, recipes and event schema v3
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** M4 lets the player change tactics between sets while watching (TD-003) and carry fatigue from week to
  week into matches. Saves should not store whole event streams (TD-009).
- **Decision:**
  - `startMatch(config, seed)` → `LiveMatch`; `advance(live, 'set' | 'match')` plays on and returns the new events;
    `setTactic(live, player, tactic)` is allowed only while stopped between sets and records a `tactic_change`
    event; `finish(live)` gives the `MatchResult`. `simulateMatch` is now start + advance('match') + finish.
  - `MatchRecipe { config, seed, tacticChanges: { afterSet, player, tactic }[] }` and `replayMatch(recipe)` play a
    match again exactly.
  - `MatchConfig.condition?: { fatigue: [a, b] }` sets each player's fatigue at the first point (0–1, absent = 0).
  - `SCHEMA_VERSION` becomes 3. The renderer plays v2 and v3, and a match still in progress (events without
    `match_end`): its timeline is a prefix of the finished match's, so playback can resume at the same second.
- **Consequences:** With no tactic changes and no starting fatigue every result is unchanged: the outcome and
  fingerprint goldens hold and 10,000-match reports on all three surfaces are byte-identical. Changing to
  aggression 1 after set one raises a player's share of points ended by their own winner or unforced error by more
  than 15% over 300 matches; starting at fatigue 0.8 costs more than 5 points of win rate over 400 matches.

## ADR-011: The game layer and the M4 season
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** M4 needs a playable season (GDD §9.1–9.4). The user accepted every default in the M4 clarification round.
- **Decision:**
  - `@tennis/game` is a separate workspace: deterministic, headless, built on the engine's public index (same ESLint
    rules as the engine). A career seed is split into named streams (`world`, `draw/week`, `match/week/round/pair`,
    `week/week/player`, `plan/week/player`), so a change in one never shifts another. State is plain JSON, updated by
    pure functions.
  - World: the user plus 63 AI players, levels ~N(13.2, 1.45), ages 18–34, hidden potential by age, made-up names.
    The user is 18, created from a style template and a 230-point budget (8–15 per rating), potential 16–18, and
    starts around 40th.
  - Season: 24 weeks, 14 tournaments (2 Majors best of 5 with 64-player draws, 3 Masters and 5 250s with 32, 4
    Challengers with 16), surfaces hard → clay → grass → hard, ATP-scaled points by rounds won. Rankings add the
    season's points to last season's, which start from the level order and fade out linearly by week 24. Draws seed
    a quarter of the field on standard lines; byes go to the top seeds.
  - Weeks: the user enters, trains (focus × intensity) or rests; AI players enter by tier (Majors and Masters
    always, 250s 60%, Challengers 75% and not when ranked in the top 24), rest when tired and otherwise train their
    weakest area at normal intensity. Entry lists take the best-ranked who want in.
  - Player model: training adds progress to the focused ratings scaled by age and headroom to potential; a week of
    matches teaches every rated skill a little; fatigue comes from training, sets played and back-to-back events,
    and 60% of it is the engine's starting fatigue; injuries are rolled weekly from load, fatigue and
    `injuryProneness`; ratings fade after 30.
  - The user's match waits for the UI as a `PendingMatch` (config + seed, the user as player A); the UI returns a
    `MatchRecipe`, which the game replays to record the result. Every other match is simulated at once.
- **Consequences:** `npm run season -- --n 50 --seed 1` (AI-only, about 63 s):

  | Metric | Value | Target |
  |---|---|---|
  | Ranking vs ability (Spearman) | 0.91 | ≥ 0.70 |
  | Prospect growth per season (overall, 18–19, room to grow) | 1.90 | 1.5–3.0 |
  | Players injured per season | 10.1% | 5–15% |
  | Champions and points bookkeeping | ok | ok |

  The AI-played user finishes 39th on average and gains 2.09 overall. `npm run test:season` guards these with 10
  seasons. A season takes about 1.3 s of simulation, all on the main thread.

## ADR-012: Save files keep recipes, not events
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** M4 saves careers in IndexedDB. A finished match's event JSON is about 0.4 MB (TD-009), and a season
  has hundreds of matches.
- **Decision:**
  - `SaveFile { saveVersion: 1, summary: { name, week, savedAt }, state: SeasonState }`. The state is plain JSON.
    AI matches keep only their winner and score; the user's matches keep a `MatchRecipe`, from which any replay is
    rebuilt with `replayMatch` (ADR-010).
  - `fromSave` refuses any other `saveVersion` with a clear message rather than migrating; there are no older saves.
  - Slots: `auto` (written at the end of every week) and `slot1`–`slot3`. `SaveStore` is the interface:
    `MemoryStore` for tests, `IndexedDbStore` (ui/, database `tennis-sim`, object store `saves`) in the browser.
  - The game layer never reads the clock: the UI passes `savedAt`.
- **Consequences:** A season's save is about 35 KB at the start and 95 KB at the end with 19 of the user's matches
  (one match's events used to be 0.4 MB). Loading and carrying on gives exactly the weeks that would have followed
  without saving, and replays from loaded recipes have the same fingerprints.

## ADR-013: M4 user interface
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** The career needs a handful of management screens and the M3 broadcast for the user's matches. The
  user chose no UI framework.
- **Decision:**
  - Screen data comes from pure view models in `game/src/views` (unit-tested); `ui/src/career/screens` draw them with
    a 30-line `h()` helper that only creates text nodes. A hash router (`#/home`, `#/tournament`, `#/match`, …)
    picks the screen; renders are async and tokened, so only the latest one shows.
  - `ui/src/main.ts` loads the dev replay page for `?seed=` and the career app otherwise. The broadcast view
    (`replay/broadcast.ts`, which pulls in Three.js) is imported only by the match screen and the replay page.
  - The match screen plays the user's match set by set (ADR-010), stops at each set break for tactics, and hands the
    recipe (config, seed, tactic changes) to `playRound`. Leaving discards the match; it can be started again.
  - Weeks close with an autosave; a tournament the user is not in (or is out of) is played out by `playOut`.
  - The page publishes `data-camera`, `data-clip`, `data-point`, `data-t` and, on match screens, `data-fingerprint`
    for the e2e tests.
- **Consequences:** The career screens load 2.6 + 35.8 + 16.6 kB of script; the 574 kB broadcast chunk (Three.js)
  loads only when a match is watched. `npm run test:e2e` checks the career end to end, including that a match
  watched with a tactic change matches the same recipe replayed in Node.

## ADR-014: Casual direction from the 2026-10-13 design brief
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** After M4 the user shared a new design brief (`docs/casual-design.md`, Korean): a casual web game
  whose priority is a 1–2 minute short loop with a decisive choice before each point and a visible reward after
  every match. It conflicts with the GDD's football-manager depth and full-match broadcasts.
- **Decision:** The brief is the newer source of direction; the GDD keeps the parts that do not conflict and gains
  §13 with the decisions taken for M5. M5 becomes a casual quick-match MVP (Fast4, per-point cards, an adaptive AI,
  a 64-player ladder, post-match rewards) built on the existing engine, renderer and game layer. The M4 season mode
  stays as it is; multi-season play, finances and staff move to M6 or later.
- **Consequences:** Balance targets for the short loop (length, no dominant card, reading the AI pays off, ladder
  pace) become measurable done criteria (ADR-016). Engine changes must keep card-free matches byte-identical.

## ADR-015: Fast4, point-by-point play and cards (event schema v4)
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** The casual quick match (ADR-014) is one Fast4 set with a card chosen before every point.
- **Decision:**
  - `MatchRules.bestOf` may be 1, and `setFormat: 'fast4'` plays sets to four games with a tiebreak at 3-3 to five
    points, the point at 4-4 deciding it (No-Ad is the separate `noAd` flag). Absent means 'standard'.
  - `advance(live, 'point', { cards })` plays one point; `Card` is `attack | defend | counter` and
    `PointEvent.cards` records both players' cards. `MatchRecipe.cards` (by point index) replays such matches.
  - `SCHEMA_VERSION` becomes 4; the renderer plays v2–v4 and draws card matches like any other.
  - Card effects (`point/cards.ts`, `CARDS` in tuning) are numerical only and draw no random numbers. A card sets its
    player's risk appetite for the point and, by role, tilts the serve (attack: in % −, aces +, quality +; defend:
    in % +, aces −). Winning the matchup scales that player's rally errors by exp(−0.22·k), shifts their winners by
    +0.22·k on the logit and moves serve aces and quality; losing it does the reverse. k is the card's strength:
    1 + 1.5 × (mean of its ratings − average) × style (×1.15 for a style built for it) × (1 − 0.6 × fatigue) for attack.
  - Average players, 20,000 points each, server's point-win shift from the card-free 0.625:

    | Server \ returner | attack | defend | counter |
    |---|---|---|---|
    | attack | +0.009 | +0.110 | −0.100 |
    | defend | −0.142 | −0.005 | +0.109 |
    | counter | +0.114 | −0.121 | 0.000 |

    Against an even mix of the returner's cards the three serve cards land within 0.018 of each other, and the three
    return cards within 0.007. Attack serves 46% more aces and 3.4× the double faults of defend.
- **Consequences:** Matches without cards are unchanged: goldens hold and 10,000-match reports on all three surfaces
  are byte-identical. A Fast4 set with No-Ad runs a median of 35 points (quartiles 29/35/40 over 1,000 matches), not
  the 20–32 estimated when M5 was planned; the 1–2 minute target is met through short per-point clips (ADR-016).

## ADR-016: Quick-match AI, ladder, rewards, pacing and balance targets
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** The casual short loop (ADR-014) has to be short, decided by the user's reads, varied, and rewarding
  after every match. These are design targets, checked by `npm run quick` and guarded by `npm run test:quick`.
- **Decision:**
  - **AI** (`game/src/quick/ai.ts`): a style's card habits (a big server attacks with the serve 60%, a baseliner
    defends 50%, a counter-puncher counters 50–55%), a tell (it leans 30% towards repeating its own last card), a
    mild read of the user (up to 15% towards the card that beats their recent habit), less attack when tired; the
    mix is pulled towards even until no card passes 60%, which keeps at least 1.35 bits of entropy.
  - **Ladder** (`quick/ladder.ts`): 64 players start from level order (1600·e^(−(rank−1)/16) points); the next
    opponent is one of the three just above; a win pays 20 + 4 per place above, a loss costs 6; six neighbouring AI
    pairs play after each user match. **Rewards:** each card played adds 0.008 progress to its ratings (×1.5 for a
    win), shown after the match.
  - **Pacing** (`quick/pace.ts`, used by the UI and the report): per point a 0.4 s card reveal, the last 2.2 s of
    the rally at 2.5× (the whole point for a set- or match-winning point, a converted break or a 10+ shot rally),
    and a 0.4 s score beat. The card matchup edge was raised to 0.25 (from 0.22) during this tuning; ADR-015's matrix
    stays inside its ±0.08–0.17 bound.
- **Consequences:** `npm run quick -- --n 2000 --seed 1` (30 ladders, about 13 s):

  | Metric | Value | Target |
  |---|---|---|
  | Points per match (median) | 34 | 28–40 (was 20–32 before ADR-015 measured Fast4) |
  | Seconds on screen per match (median) | 87 s | ≤ 90 s |
  | Always attack / defend / counter vs the adaptive AI | 38.5% / 41.9% / 35.9% | ≤ 45% |
  | Always attack / defend / counter vs any card | 51.1% / 51.1% / 46.6% | 45–55% |
  | Reading the AI perfectly | 68.7% | ≥ 60% |
  | AI card entropy | 1.58 bits | ≥ 1.3 |
  | Win % by rating 11/12/13/14/15 against 13 | 29/41/54/62/73 | rising |
  | Places climbed in 30 matches (reads the AI half the time) | 23.5 | 10–25 |

  Random cards win 49.2% against the adaptive AI. The first tuning pass had reading pay only 54%: the AI's read of
  the user diluted its own pattern, so adaptation went down (40% → 15%) and the repeat tell was added.
