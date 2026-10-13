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
- **Status:** Superseded by ADR-017 (the per-point design and its targets were replaced after the first playtest);
  the ladder points rule still holds
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
    the rally at 2.5× (up to the last 8 s for a set- or match-winning point, a converted break or a 10+ shot
    rally), and a 0.4 s score beat. Fast mode skips the 3D and shows the result only. The card matchup edge was raised to 0.25 (from 0.22) during this tuning; ADR-015's matrix
    stays inside its ±0.08–0.17 bound.
- **Consequences:** `npm run quick -- --n 2000 --seed 1` (30 ladders, about 13 s):

  | Metric | Value | Target |
  |---|---|---|
  | Points per match (median) | 34 | 28–40 (was 20–32 before ADR-015 measured Fast4) |
  | Seconds on screen per match (median) | 69 s | ≤ 90 s |
  | Always attack / defend / counter vs the adaptive AI | 38.5% / 41.9% / 35.9% | ≤ 45% |
  | Always attack / defend / counter vs any card | 51.1% / 51.1% / 46.6% | 45–55% |
  | Reading the AI perfectly | 68.7% | ≥ 60% |
  | AI card entropy | 1.58 bits | ≥ 1.3 |
  | Win % by rating 11/12/13/14/15 against 13 | 29/41/54/62/73 | rising |
  | Places climbed in 30 matches (reads the AI half the time) | 23.5 | 10–25 |

  Random cards win 49.2% against the adaptive AI. The first tuning pass had reading pay only 54%: the AI's read of
  the user diluted its own pattern, so adaptation went down (40% → 15%) and the repeat tell was added.
  Measured in the browser (Playwright, headless Chromium): a fast-mode match of 26 points took 22.6 s with instant
  clicks; a 3D match of 38 points took 178 s, because headless software WebGL renders about 8 frames a second and
  every frame blocks the timers. Real GPU timing is unmeasured (TD-024).
  - **UI** (ADR-013 structure): the menu leads with the quick ladder; `ui/src/quick` has the ladder, the match
    (cards on keys 1/2/3, reveal, clip via `playWindow`) and the result; the ladder saves under the IndexedDB key
    `quick`, outside the season slots.

## ADR-017: Playtest redesign — one tiebreak, decisions at big points, readable opponents, rewards that land
- **Date:** 2026-10-13
- **Status:** Accepted (numbers are filled in as the M6 streams land)
- **Context:** The user played the M5 quick match and reported: a card before every point is tiring, a Fast4 set
  feels like a full match, the AI cannot be read so it feels like rock-paper-scissors, and the result screen does not
  land. In code, the choose screen only knew the score; the AI mixed cards per style at 1.58 bits (uniform to a
  human); the result showed fractional rating progress. ADR-016's targets were tuned for the rejected design and are
  replaced, not patched.
- **Decision:**
  - **Format:** `setFormat: 'tiebreak'` — a match is one tiebreak to seven, two clear, from 0-0 (event schema v5;
    the set reads 1-0 at the end). Recipes store `null` for points played without cards.
  - **Decisions:** the user picks a game plan (aggressive / balanced / defensive) before the match; points play on
    with that tactic and no cards, quickly. The match stops for a card only at big points (once either player has five points — first planned as
    from 5-5, see the flow sub-bullet — and any set or
    match point): three to five per match. At those points a won matchup is worth about +25 pp of point-win chance.
  - **Readable opponents:** every opponent has a persona (a habit such as "attacks on big points" or "counters after
    losing a point") derived from the seed and their id. A scouting line before the match names it; the choose
    screen shows the opponent's cards this match and a tell drawn after the AI's card is fixed, right about 70% of the
    time; a rival record carries over to the next meeting (quick save v2). Exploiting one opponent's habit is the
    point; no card may dominate across all opponents.
  - **Rewards:** the result replays the decisive point and names the choice ("6-6: your counter beat their attack"),
    then counts up the ladder points, names the players passed, shows ratings as whole numbers on a 0–100 scale
    rising, and the wins needed for the next goal.
  - **Parallel work:** a contract commit (shared types, split view modules, reserved tuning blocks) lets three
    sessions build the match flow, the opponent read and the result screen on disjoint files.
- **Consequences:** targets (`game/src/quick/targets.ts`, `npm run quick`):

  | Metric | Target |
  |---|---|
  | Points per match (median) | 10–14 |
  | Decisions per match | median 3–5; ≥ 2 in 90% of matches |
  | Seconds on screen per match (median, decisions aside) | ≤ 60 s |
  | Won matchup at a big point (average players) | +20–30 pp point-win |
  | Knows the habit, vs equal rating | ≥ 65% match wins |
  | Follows the tells only | ≥ 57% |
  | Random cards | 45–55% |
  | One card always, across all opponents | ≤ 55% for each card |
  | Habit card in its situation | 60–75% |
  | Win % by rating | rising |
  | Places climbed in 30 matches (reads half the time) | 10–25 |
  | Won matches where a shown rating rises | ≥ 80% |
  | Matches with decisions where a decisive moment is found | 100% |
  - **Flow (stream ①):**
    - *Card weight.* `CARDS` edge values were doubled: edgeError 0.4, edgeWinner 0.5, edgeAce 0.6, edgeQuality 0.08
      (were 0.25 / 0.25 / 0.2 / 0.03). This supersedes ADR-015's matrix and its ±0.08–0.17 bound. Average players,
      20,000 points each; the table shows the server's point-win shift from the card-free 0.623:

      | Server \ returner | attack | defend | counter |
      |---|---|---|---|
      | attack | +0.013 | +0.206 | −0.239 |
      | defend | −0.281 | −0.006 | +0.226 |
      | counter | +0.226 | −0.260 | +0.000 |

      Against an even mix of the returner's cards, the three serve cards land within 0.006 of each other; the three
      return cards land within 0.013. Attack still serves 2.1× the aces and 3.4× the double faults of defend. The
      serve terms carry more of the increase than the rally terms. Scaling all four evenly would cancel a
      big-serving hitter's extra edge from attack.
    - *How it is measured.* `matchupEdge` (`quick/balance.ts`) plays one-tiebreak matches between two average
      players, each holding one card at every decision point. The six card pairs share seeds. The result is the
      user's point-win share at decision points with the card that beats the opponent's card, minus the same
      share with the same card as the opponent. Both roles and the pressure of big points are included.
    - *Card-free matches.* They are unchanged: engine goldens pass, and `npm run sim -- --n 10000 --seed 42` is
      byte-identical before and after on hard, clay and grass.
    - *Decision points.* `isDecisionPoint` stops once either player has `QUICK_MOMENTS.fromPoints` (5) points, and
      at any set or match point. The rule a player reads: "from 5 points on, every point is a big point". 5-all
      gave a median of 2 decisions with 62% of matches at 2 or more. Now the quartiles are 2 / 3 / 5, the 90th
      percentile is 7, and every match has at least 2 (TD-030). The banner names every stop: MATCH POINT,
      MATCH POINT DOWN, N-ALL, or BIG POINT.
    - *Pace.* `QUICK_PACE` is shared by the UI and the model (`pointSeconds`). A point without cards shows its last
      1.6 s in 3D at 3× plus a 0.35 s ticker beat; fast mode shows the beat only. A decision point gets a 0.6 s
      reveal, the whole point (at most its last 8 s) at 2×, and a 0.6 s score. ADR-016's per-point clip rules
      (key rally, decisive point) no longer pick the window; every decision point plays whole.
    - *Game plan.* Three toggles next to Play on the ladder. The last choice is remembered in localStorage
      (`tennis-quick-plan`), and the plan is passed to `startQuick`. The ticker shows it during the match.
      Aggressive is slightly dominant (TD-031).
    - *Report.* `npm run quick -- --n 2000 --seed 1`, flow rows:

      | Metric | Value | Target |
      |---|---|---|
      | Points per match (median) | 11 | 10–14 |
      | Decisions per match (median) | 3 | 3–5 |
      | Matches with 2+ decisions | 100% | ≥ 90% |
      | Seconds on screen per match (median) | 21 s | ≤ 60 s |
      | Won matchup at a decision point | +24.6 pp | +20–30 pp |
      | Win % by rating 11/12/13/14/15 vs 13 | 38/42/50/60/69 | rising |
      | Places climbed in 30 matches | 19.2 | 10–25 |

  - **Read (workstream ②), 2026-10-13:** six habits, each a rule checkable on the choose screen (`habitCard` in
    `game/src/quick/persona.ts`): `big_point_attack` attacks at any match point; `counter_after_loss` counters after
    losing the last point; `repeat_card` repeats its own card from the last decision; `defend_unless_behind` defends
    when level or ahead; `copy_user` plays the user's last decision card; `beat_user_last` plays the card that beats
    it. The contract's `repeat_winner`, `defend_when_ahead` and `safe_on_match_point` applied at only 32–37% of
    decisions (two of the six would then defend), so the first two were widened and the third replaced; habits now
    apply at 63% of decisions. When the habit applies the AI plays its card `QUICK_PERSONA.habitShare` = 0.72 of
    the time, the rest in its style mix's proportions; otherwise the style mix (`QUICK_AI`, whose `sticky` repeat is
    removed: repeating is now one persona's habit, not everyone's noise). The tell is drawn after the card from a
    stream seeded by one draw of the decision stream (so tell accuracy never shifts the card), points at the real
    card 70% of the time, and has four short texts per card. Rival records (`recordRival`, last 12 big-point cards)
    ride in `QuickState.rivals`, quick save v2 (v1 loads with none). Measured on this branch (`npm run quick -- --n
    2000 --seed 1`, flow still at 2 decisions and +14 pp a won matchup): habit share 72.5%, random 51.0%, always
    attack/defend/counter 48.4/51.5/49.1%, follows the tells 58.5% (matchups won 70% / lost 15%), knows habit and
    style (`scoutBot`) 56.3% (64% / 18%), habit only 54.8%, odds ceiling 56.3%. With the flow approximated (won
    matchup +29 pp, decisions from 4-4: 3.4 a match) the same code gives 66.7% / 64.8% / 68.9% and fixed cards
    44–48%: the habit target needs ① near the top of its edge range (TD-033).
  - **Result (③):** `quick/highlight.ts` picks the decisive moment: in a win the last decision the user won (the last
    won matchup among those first), in a loss the last one lost (the last lost matchup first), else the last decision;
    its line names both cards and the score before it ("6-6: your counter beat their attack", "…, but they won the
    point", "both went defend, and you won the point"). Without a decision the final point is shown with "Your plan
    carried it" / "They closed it out". `finishQuick` records `overtakes` (above the user before, below after,
    background matches included; the old rank shown). Ratings are shown as floor((rating + progress) × 5), 5–100.
    **Reward:** the card progress of ADR-016 stays; a win also lifts the rating behind the decisive card (or behind
    the game plan without a decision) that is nearest its next whole shown number up to it, at most 0.2 rating — the
    win always shows a rise named after the choice that won it. Before this, 10% of won matches showed a whole-number
    rise. Measured (`npm run quick -- --n 2000 --seed 1`, 30 ladders of 30 matches, reader bot, on the contract's
    flow): visible rise in 100% of wins, 0.54 shown points a match, decisive moment in 100% of matches with a decision,
    0.91 players passed a match; places climbed in 30 matches 17.7 before and after (the extra progress rarely crosses
    a whole rating, which is what the engine reads). **Next goal** (`quick/standing.ts`): the first of Top 50/32/16/8
    and #1 above the user; wins needed counts wins over an opponent two places up (the average of the three possible),
    the rest of the ladder standing still. **Screen** (`ui/src/quick/result.ts`): the decisive point replays full
    screen in 3D with the line as a caption (the whole point up to its last 8 s, at 1.25×), or as a play-by-play in
    fast mode; then the result, the points counting up, the players passed, the ratings (rises first, bars growing
    from the old share) and the next goal, each fading in; click or space skips to the end and [Play again] takes
    focus. All final texts are in the page from the start (①'s e2e reads them at once). Fast mode reveals in about 5 s.

  - **Follow-up after integration (2026-10-13, approved by the user):**
    - *Decision cap:* `QUICK_MOMENTS.maxDecisions` = 6. A marathon tiebreak plays on without cards after the sixth
      decision (was a 90th percentile of 7 and 20+ in marathons). New target: most decisions in a match ≤ 6.
    - *Tells:* accuracy 0.7 → 0.6. At 0.7 following the tells (68.5%) beat reading the habit (65.3%), so players could
      ignore the scouting line. At 0.6: tells 62.3%, habit and style 63.2%, random 50.3%, fixed cards 46.7–48.4%.
    - *Habit target 65% → 62%:* the cap costs about 2 pp of reads. Deciding from 4 points would restore 66%, but at
      a median of 5 decisions a match, against the playtest's "too many choices"; raising the card edge to +27 pp
      gave only 64.4% and broke the stat-scaling check, so it was reverted.
    - *Losses reward too:* the nearest rating behind the decisive card moves by up to `QUICK_REWARD.lossStep` (0.1,
      half a shown point). 53% of lost matches now show a whole-number rise (new target 40–80%); wins stay at 100%.
      Ladder climb 20.5 in 30 matches.

## ADR-018: Art direction B "Rally Pop"
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** The research in `docs/design-references.md` (references by screen, licence and colour checks, three
  directions with style tiles) recommended B "Rally Pop" for the casual loop; the user chose it over A "Night
  Session" (the fallback) and C "Tactics Board".
- **Decision:** a sunny club court in a toy box: toon 3D with ink outlines, sticker cards, springy reveal and
  count-up motion, Lilita One + Nunito with Barlow Condensed kept in the score bug. Phased:
  - **Phase 0 (done with the M6 merge):** the colour-blind-safe card trio as tokens (`--atk #ff7a45`, `--def #4aa3ff`,
    `--ctr #3fd3b0`; smallest ΔE after protan/deutan simulation 38/53, against 2/13 before), a Lucide icon on every
    card and card chip (zap, shield, rotate-ccw; ISC, path data copied into `ui/src/lib/icons.ts`, no package),
    and won/lost shown with the accent, a muted tone and a symbol (✓ / ✗ / =) instead of green against red.
  - **Phase 1:** UI tokens, self-hosted fonts and motion, the light Rally Pop palette.
  - **Phase 2:** the renderer (toon materials, outlines on players/net/ball, an unlit ball with a trail, daylight,
    per-surface kits, chunkier proportions), built in parallel with M6 because no M6 stream owned renderer files.
  - **Phase 3:** rig proportions or a CC0 chunky body (TD-012).
- **Consequences:** the M3 default of a realistic Mesh2Motion body no longer fits; TD-012 is decided in phase 3.
  `e2e/quick-colours.spec.ts` guards phase 0.


## ADR-019: Art direction B "Rally Pop", phase 2 (renderer)
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** The user picked direction B "Rally Pop", a sunny club court in a toy box (docs/design-references.md
  §5 B, §6 phase 2). The M3 scene was Lambert-shaded primitives under a dark sky, a small Lambert ball (about 3.7 px
  across at the far baseline at 720p), player A in red on a clay court of nearly the same hue, and no outlines.
  Phase 2 is renderer-only: no UI CSS or fonts (phase 1 follows the M6 merges), no new rigs or assets, no new
  dependencies, no post-processing.
- **Decision:**
  - **Materials.** `scene/materials.ts` hands out one material per colour: `MeshToonMaterial` on a shared 3×1
    `DataTexture` gradient (bands 150 / 205 / 255, nearest filtering; a darker shadow band went muddy on backlit close-ups), or the old `MeshLambertMaterial` when
    `LOOK.toon` is false, so the two looks can be compared from tuning. Court, venue and players use it.
  - **Outlines.** Inverted hulls (`scene/outline.ts`): a back-face copy of a part with seams welded
    (`mergeVertices`) and normals smoothed, pushed out in the vertex shader by
    `px · 2 · depth / (projection[1][1] · 720)`, so a line is `LOOK.outline.px` (1.5) pixels of a 720-pixel-tall
    view at any distance and field of view. Uniform scaling was rejected: it gives a torso a line four times as thick
    as an arm and moves off-centre parts. Only players (body, head, racket head, arms, thighs, shins: 9 each), the
    net (two posts, and the tape, now a thin tube so it can carry one; a plane cannot) and the ball are outlined:
    22 extra draws, capped at 24 by a test. No `OutlineEffect` or composer pass.
  - **Ball.** Unlit `MeshBasicMaterial` in optic `#d6f53a`, `toneMapped` and `fog` off, radius 0.11 m (3.3× real):
    at least 6 px across at the far baseline from the main camera at 720p (unit-tested by projection), drawn at
    0.45× on serve/reaction/Hawk-Eye close-ups and 0.8× on the side camera. Ink outline, blob shadow always under it.
    A 1.3× scale pop at contact eases out over 0.07 s. The trail is one camera-facing ribbon (12 samples, a small
    `ShaderMaterial`: the CPU lays the centre line, width and opacity, the vertex shader turns it to the camera),
    white, tapering in width and opacity over 0.2 s of match time, 0.1 s in half-speed replays. Trail and pop are
    pure functions of point time (`scene/ballMotion.ts`, sampling `ballAt`), cut at the last contact: a seek or a
    replay draws exactly what live play drew. `Line2`/`LineMaterial` was not used: it has one width and opacity per
    line (no taper) and needs its resolution set from `viewer.ts` on every resize.
  - **Broadcast frames.** A `BroadcastFrame`'s `t` is programme time; the stage keys trail and pop off `matchT`
    (and `camera`, `clip`) when present. `StageFrame` gained those optional fields; `viewer.ts` is unchanged.
  - **Daylight.** A warm directional sun (2.0) over a sky/ground hemisphere (1.0); the ambient light is gone because
    flat ambient fills the toon bands. A vertex-coloured sky dome (radius 200, inside the 400 m far plane) blends
    horizon `#d3e8f2` to zenith `#4f9de0`; `Fog(horizon, 50, 200)` hazes the far stands into it and leaves the
    court clear (the far baseline is ~44 m from the main camera). **No tone mapping:** the palette is chosen in
    sRGB against WCAG-style contrast with the ball, and AgX/ACES/Neutral desaturate and darken it and would need
    every light retuned; the ball must stay exactly optic.
  - **Palette and kits.** Courts hard `#3470b8`, clay `#b8552e`, grass `#2f7a45`; lines off-white `#f3f0e6`.
    `COLOURS.kits[surface]`: A wears the colour (red on hard, blue on clay and grass), B the light kit everywhere.
    Tests: no shirt within 40° of hue of its court or surround; on clay no red/orange, on grass no green; nothing but
    the ball within 25° of the ball's hue at saturation ≥ 0.4. Racket heads are a pale string bed with an ink rim.
  - **Proportions.** Chunkier mannequin from tuning alone: head radius 0.13 → 0.19, racket head 0.14 → 0.19, legs
    0.45 → 0.43 per segment and thicker, arms 0.6 → 0.56 and thicker, a wider torso. The racket still reaches a serve
    struck at 2.6 m and up (engine serve contact: 2.60–2.95 m, median 2.79).
- **Consequences:** Draw calls at the main camera on the replay page (1280×720, seed 42, key points):
  hard and clay 86 → 110, grass 92 → 116 (+22 outlines, +1 trail, +1 sky); triangles 2.9k → 5.9k (hulls copy their
  parts). Headless Chromium uses software WebGL, so fps is indicative only (TD-024) and was measured on a loaded
  machine, alternating the two builds: 25–31 fps before, 20–24 after (−20 to −25%). Turning parts off one at a
  time: without the sky dome +3–4 fps (it is now drawn after the opaque meshes), without rig outlines +0.5–1,
  Lambert instead of toon no change. The software rasteriser is fill-bound. On a desktop GPU (Chrome on Windows,
  RTX 5060, i5-14600KF, canvas 3841×1849 at DPR 1.75, clay main camera) both builds hold the 60 fps refresh cap and
  the frame callback takes 0.5 → 0.6 ms median (p95 0.8 → 1.0 ms). Screenshots before and after (main, serve, side, reaction on each surface) are in
  `docs/screenshots/rally-pop/` (not committed). Phone performance, the GLTF/CC0 rig, the umpire chair in the side replay
  camera and the polish left out are open (TD-038–TD-041).


## ADR-020: Art direction B "Rally Pop", phase 1a (UI theme)
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** Phase 1 of ADR-018 restyles the DOM UI. It is split in two parallel sessions: 1a (this one) owns the
  palette, fonts, icons and the CSS of every screen; 1b owns motion (`ui/src/quick/motion.css`, `lib/motion.ts`,
  `quick/{match,result}.ts`) and refers to the colour tokens by name. The UI was dark navy panels, one yellow accent,
  `system-ui`. No new dependencies; fonts and icons are copied files.
- **Decision:**
  - **Tokens** (`ui/src/theme.css`, imported first by `style.css`): `--court #123a8c` (UI base), `--court-2 #1b4db3`,
    `--paper #ffffff` (cards, tiles), `--paper-2 #eef3fc` (tracks, tints), `--ink #15171e` (outlines, text on paper),
    `--ink-muted #5a6172`, `--optic #d6f53a` (Play, "You read it!", the live accent), `--gold #ffc21a` (ladder
    points, the moment banner, rises), `--gold-tint #fff1c2`; card fills `--atk #ff7a45`, `--def #4aa3ff`,
    `--ctr #3fd3b0` (phase 0, kept) and text variants `--atk-text #c2410c`, `--def-text #0b66d6`, `--ctr-text #047e73`.
    Surface tokens `--text`, `--muted`, `--win`, `--loss`, `--link`, `--rule`, `--error`, `--focus` hold the court-blue
    values on `:root` (white, `#bfd0f2`, optic, `#bfd0f2`, …) and are re-pointed on paper surfaces (`.paper`, `.card`,
    `.card-btn`, `.chip`, `.gain`, `.decisive`, `.overtake`, `.match-panel`, `.note-banner`, `header.top` and form
    controls) to ink, ink-muted, court, ink-muted, … so a component written once reads on both. Kept names re-pointed:
    `--panel-bg` and `--bug-bg` are ink at 0.86 / 0.92, `--bug-accent` is optic. Sticker helpers: `--outline` (3 px
    ink), `--lift` (0 5 px 0 ink).
  - **Card text colours.** The doc's `#C23A1C / #1565C8 / #0B7F6A` gave a smallest ΔE of 32 (protan, Attack–Counter).
    A scratch search over hue ±9° of the phase-0 fills at ≥ 4.6:1 on white reached 49; the trio above gives up a
    little ΔE for ≥ 5.0:1. Smallest CIE76 ΔE after Machado 2009 simulation (severity 1):

    | Trio | Normal | Protan | Deutan | Tritan |
    |---|---|---|---|---|
    | Fills `#ff7a45 / #4aa3ff / #3fd3b0` | 78 | 38 (A–C) | 53 (A–C) | 18 (D–C) |
    | Text `#c2410c / #0b66d6 / #047e73` | 80 | 45 (A–C) | 61 (A–C) | 16 (D–C) |
    | Doc B text `#C23A1C / #1565C8 / #0B7F6A` (rejected) | 79 | 32 | 51 | 15 |

    Tritan stays the weakest (Defend–Counter); every card and chip keeps its Lucide icon, name and key.
  - **Contrast** (WCAG 2; every text/background pair in the CSS; large = 18.66 px bold or 24 px):

    | Pair | Ratio |
    |---|---|
    | White / court (body, headlines, verdict "=") | 10.4 |
    | Muted and loss `#bfd0f2` / court | 6.7 |
    | Optic / court (win, verdict ✓, title, pips) | 8.4 |
    | Link `#dce6fa` / court | 8.3 |
    | Error `#ffb4a6` / court | 6.1 |
    | White / tell band (12 % white over court) | 7.5 (muted label 4.8) |
    | Muted / decision panel over a white sky (95 % court) | 5.9 |
    | Ink / paper | 17.9 |
    | Ink-muted / paper | 6.2 |
    | Court / paper (win on paper, brand, overtaken rank) | 10.4 |
    | Court-2 / paper (links, ▲) | 7.6 |
    | Attack, Defend, Counter text / paper | 5.2, 5.4, 5.0 |
    | Ink key / Attack, Defend, Counter band | 6.9, 6.8, 9.5 |
    | Ink / optic (Play, active buttons, bug points) | 14.5 |
    | Ink / gold (moment banner, points tile) | 11.1 |
    | Ink, ink-muted / paper-2 | 16.1, 5.6 |
    | Ink, ink-muted / gold tint (your row) | 15.9, 5.5 |
    | White / selected plan toggle (court) | 10.4 |
    | Error `#b42318` / paper | 6.6 |
    | White, muted, optic / bug (ink 0.92 over a white sky) | 14.3, 9.2, 11.6 |
    | White, muted / dev panel (ink 0.86 over a white sky) | 11.8, 7.6 |

    Non-text: paper card on court 10.4, optic pip 8.4, hollow "their point" pip ring 6.7, gold decision ring 6.5,
    focus rings optic on court 8.4 and court-2 on paper 7.6. Ink-muted on gold is 3.8, so the gold tile's label is ink.
  - **Won and lost** (ADR-018): the accent (optic on court, court on paper) against the muted tone, always with a
    word or symbol (✓ / ✗ / =, W / L, ▲ / ▼); pips add shape (filled yours, hollow theirs). Hawk-Eye IN is optic, OUT
    white; career rank moves follow win/loss instead of green/red.
  - **Fonts** (`ui/public/fonts/`, `ui/src/fonts.css`, google/fonts commit 8b0a1d0, one OFL.txt each):
    Lilita One 400 (11.9 KB) for h1/h2, the rank, verdicts, card names, big numbers and big buttons; Nunito 600/800
    (16.6 + 16.5 KB) for body; Barlow Condensed 600/700 (24.1 + 24.3 KB) for the score bug and broadcast overlays only.
    93.4 KB in total; a quick screen loads ~45 KB (Lilita + Nunito), Barlow only with the broadcast. `font-display:
    swap`, system fallbacks, Lilita and Nunito 600 preloaded. Nunito is instanced from the variable font and Nunito and
    Barlow are Latin-subset with fontTools; Lilita One is converted to WOFF2 only, because its OFL reserves the name
    "Lilita" and a subset would be a Modified Version.
  - **Sticker cards:** paper, 3 px ink outline, 16 px radius, a 5 px ink drop shadow, a 26 px band in the card's fill
    with the key in its corner, a 30 px icon and the name in Lilita in the card's text colour, strength as an
    ink-outlined bar. The same sticker language covers chips, the gold tilted moment banner, result tiles (the points
    tile gold on a win), overtake pills, the ladder rank card (gold trophy, gold progress bar), the next-opponent card
    (scouting line with an eye, plan toggles filled court blue when chosen) and optic Play buttons.
  - **Broadcast layer:** the score bug and overlays are ink with optic, in Barlow Condensed with tabular figures. Ink
    rather than navy because the UI base and the hard court (`#3470b8`) are both blue and a navy bug sinks into them;
    ink holds 14.3:1 with white even over the daylight sky. Optic ties the live points to the ball; gold stays for
    rewards and stakes. The tiebreak points cell is paper. Dev panels on the replay page are ink at 0.86.
  - **Icons:** `lib/icons.ts` exports `icon(name)` (Lucide 0.468.0 path data, ISC) with eye, trophy and chevrons-up
    added; `cardIcon` is kept. Eye is on the tell (`scout.ts`) and the home scouting line, trophy on the rank
    (`home.ts`); chevrons-up is for 1b's rise animation (`result.ts` is theirs).
- **Consequences:** `e2e/quick-colours.spec.ts` checks the card text and band colours, white cards, the gold moment,
  4.5:1 and a protan/deutan ΔE above 30 computed in the test, and that all five faces load. Motion keyframes already
  in `quick-match.css` / `quick-result.css` were left as they were for 1b. Open: TD-042–TD-045.

## ADR-021: Rally Pop phase 1b: motion
- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** The M5/M6 playtests called the reveal and the rewards flat (ADR-017). Direction B "Rally Pop" (ADR-018,
  docs/design-references.md §1.2–§1.5, §4 Motion) proposes springy motion for the decision point, a simultaneous
  reveal after Marvel Snap and a layered result after Balatro / Clash Royale. Phase 1a (theme, fonts, palette) runs in
  parallel and owns the existing CSS; 1b adds motion only, with no new dependencies, and must not change what the game
  computes.
- **Decision:**
  - **Where it lives.** `ui/src/lib/motion.ts` (ease-out, count-up, stagger index, reduced-motion check, the skippable
    `Sequence` moved from `result-sequence.ts`, skip on click/Space/Enter) and `ui/src/quick/motion.css` (tokens,
    keyframes, `.is-*` states), imported after the screen CSS so equal-weight rules win. Tokens: `--dur-short` 150 ms,
    `--dur-medium` 280 ms, `--dur-long` 500 ms; `--ease-standard` `cubic-bezier(0.2, 0, 0, 1)`, `--ease-emphasized`
    `cubic-bezier(0.05, 0.7, 0.1, 1)`, `--ease-back` `cubic-bezier(0.34, 1.56, 0.64, 1)`. Colours only through 1a's
    tokens with today's values as fallbacks. Flow timing runs on timers, never on `animationend`, so a hidden tab or
    reduced motion cannot stall a match.
  - **Decision point.** The banner wipes in (240 ms, `clip-path`, emphasized); the three cards deal up 120 ms later,
    60 ms apart, 360 ms each with the back-out overshoot (`.card-btn.is-dealt`, `--i`). Hover or keyboard focus lifts a
    card `translateY(-12px) scale(1.05)` (150 ms ease-out); the pick rises to `translateY(-24px) scale(1.08)` and
    the others dim (`.cards.is-picked`, `.card-btn.is-selected`). The theme's `stop-in` on the moment chip is
    switched off: one orchestrated moment per screen.
  - **Reveal.** `QUICK_PACE.reveal = { selectSec 0.15, holdSec 0.5, flipSec 0.28, verdictSec 0.15 }`: the pick
    rises for 150 ms, both cards lie face down for 500 ms, flip together in 280 ms (one class on `#reveal`, so
    neither side can show first), and the verdict pops 150 ms after the flip (320 ms back-out) with one white frame
    (50 ms) over the pair and a 6 px kick on the winning card (none on the same card). No freeze (there is no frame
    loop to stop in the DOM) and no shake. `revealSec` is their sum, 1.08 s (was 0.6), and a test keeps it so;
    reveal plus score is 1.68 s, and it needs no skip.
  - **Ticker.** Only the newest pip pops (260 ms back-out, `.pip.is-new`); the decision screen redraws the row
    without it, and nothing covers the score.
  - **Result.** Unchanged order and phases (replay → result → points → overtakes → ratings → goal → done).
    `QUICK_REWARD.reveal` gained `staggerSec 0.12, tickSec 0.25, lockSec 0.2` and `countSec` went 0.7 → 1.0: steps
    rise with the overshoot, the three tiles 120 ms apart, the points count up with an ease-out cubic over 1 s
    (one frame each, final text also on skip or when frames stop), the names passed slide in from the right 120 ms
    apart, the rating rows rise 120 ms apart and each rating that rose rolls from its old number to its new one
    (250 ms) as its tick mark pops (`.rating-gain.is-ticked`), and the next goal stamps in 200 ms after it shows
    (`.goal.is-locked`). Then Play again takes focus. Click, Space or Enter (Enter not on a button) adds
    `.is-skipped`, which cuts every transition and animation, and shows the end state.
  - **Reduced motion.** CSS zeroes durations and delays on both quick screens, so deals, flips and pops are cuts;
    the match keeps its waits (the face-down beat is suspense, not motion, and the pace model stays the same), and
    the result starts at its end state with final numbers (an e2e test emulates `reducedMotion: 'reduce'`).
- **Consequences:** `npm run quick` median seconds on screen per match 21 → 23 s (≤ 60 s). Fast mode with instant
  picks (seeds 1–5, Playwright, 2–5 decisions): match 4.9–9.4 s (mean 7.4) → 6.0–11.8 s (mean 9.1), about +0.5 s per
  decision; the skippable result reveal 3.9–4.6 s → 5.4–6.7 s. Structural DOM: the reveal chips sit in `.flip` wrappers with a
  plain `.face.back` and the chip as `.face.front`; a rating that rose writes its numbers as `.from`, `.to` and a
  `.tick`. A `ui` Vitest project tests the pure helpers. Dead theme rules, the missing sound layer and timing-sensitive e2e bounds are TD-046–TD-048.

## ADR-022: Rally Pop phase 3: the capsule rig, polished
- **Date:** 2026-10-14
- **Status:** Accepted
- **Context:** ADR-018 left phase 3 to choose between the capsule mannequin scaled in tuning (ADR-019) and a CC0 chunky
  GLTF body (KayKit, Quaternius; TD-012, TD-039). GPU timings the same day (TD-024, TD-038) showed headroom: 0.6–0.7 ms
  CPU per frame and 60 fps at 110 draws. A quick match shows 3D in clips of one to eight seconds, often at 2–3×. The
  figure was faceted (6-sided arms, 8-sided limbs), had no racket hand, a box for each shoe, and a visor on a bare
  head that read as a stripe across the forehead.
- **Decision:** keep the capsule rig and polish it; no GLTF, no new assets or dependencies, strokes stay procedural.
  - **Parts** (`scene/rigParts.ts`, split out of `rig.ts`): arms are capsules; mitten hands (`right-hand` at the end of
    the racket arm, gripping the handle; `left-hand` for the toss); shoes are flattened capsules 0.30 × 0.13 × 0.09 m,
    soles on the ground, toes forward (were 0.24 × 0.10 × 0.06 boxes); a cap crown in the kit colour, slightly
    flattened so the figure stays under 2 m, with the visor at its brim.
  - **Tuning** (TD-039): `RIG.hand`, `RIG.shoe`, `RIG.handleRadius` and `RIG.segments` (radial 12, cap 4, head sphere
    16 × 12) replace the literals in `rig.ts`.
  - **Outlines:** hands, shoes and cap join `LOOK.outline.rigParts` (14 per player); `maxDraws` 24 → 32, exactly the
    stage's count (2 × 14 + net 3 + ball 1).
- **Consequences:** draws at the main camera 110 → 123–124. On the desktop GPU (headed Chromium through WSLg/D3D12,
  1920×1080 at DPR 1.75, seeds 3–5) the frame callback stays at 0.5–0.6 ms median (p95 0.9–1.0) at 60 fps; the phone
  proxy (390×844 at DPR 3, CPU 6× slower) 3.1 ms median, 59 fps. Before/after screenshots (hard/clay/grass × main,
  serve, side, reaction) were checked by eye and not committed. TD-012's GLTF route is closed for Rally Pop; fingers,
  shoe detail and per-player appearance stay open (TD-049).

## ADR-023: UI sounds for the quick screens
- **Date:** 2026-10-14
- **Status:** Accepted
- **Context:** ADR-021 built the motion of the decision point and the result but left out its sound layer (TD-047):
  docs/design-references.md §4 Motion asks for a crowd duck while the cards lie face down, a hit on the clash and a
  rising pitch per count-up tick. Quick matches were silent: the broadcast's sound started off behind its own toggle,
  made per screen. The user chose synthesised sounds, on by default, with a remembered mute.
- **Decision:**
  - **Sounds as data** (`renderer/src/audio/uiCues.ts`): `uiSound(cue)` returns tone and noise voices (and a crowd duck
    for the hold) from `AUDIO.ui`; the mixer only plays them on a new `ui` bus. Cues: `deal` (three triangle blips,
    3 semitones apart), `pick` (a short upward chirp), `hold` (a low hum; the crowd drops to 25% for 0.5 s), `flip`
    (a band-passed swish), `clash` (a thump, then a chord that climbs on a win, sits on a draw, falls on a loss),
    `tick` (square blips climbing up to an octave over the count, walking down a fifth on a loss; ticks closer than
    45 ms are dropped), `rise` (two notes up per rating that rose) and `stamp` (a falling thump for the goal). Every
    voice is ≤ 0.6 s and ≤ 0.5 peak (unit-tested). No samples, no new dependencies.
  - **One sound for the page** (`ui/src/lib/sound.ts`): the mixer is made on the first pointer or key press (autoplay
    policy), sound is on by default and the mute is kept in localStorage (`tennis-sound`). A `Sound on / off` pill
    (`#sound-toggle`, Lucide volume-2 / volume-x, `aria-pressed`) sits top right on the ladder, match and result.
    Quick matches hand this sound to the broadcast (`BroadcastOptions.sound`), so ball, crowd and umpire play in the
    clips too; the replay page keeps its own toggle and sliders. The crowd murmur runs under a match only
    (`Mixer.setBed`).
  - **Three-free entry:** `@tennis/renderer/audio` (package `exports`) carries the mixer and the UI cues without Three.js;
    the lint rule for ui/ allows it by name. The career screens still load no Three.js or broadcast code (e2e).
  - **Where cues fire:** deals on the CSS deal stagger (120 ms, then 60 ms apart; a pick cuts them), pick on the
    choice, hold/flip/clash from `playReveal`, ticks from `countUp`'s new `onStep` (each new number, the last one too
    when it ends on time), rise as each rating ticks, stamp as the goal locks. A skip or reduced motion plays the stamp
    alone. In dev builds `window.__sfx` logs every cue played (e2e).
- **Consequences:** e2e checks the decision point's cues in order, the result's climbing ticks, rises and stamp, the
  skip's lone stamp, and a remembered mute that plays nothing. The main `app` chunk grows 2.2 kB; the audio code shares
  a 25 kB chunk with engine code the dev page already split out. Sounds are synthesised, untested by ear in CI, and have
  no volume slider on the quick screens (TD-050).
