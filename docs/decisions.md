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

## ADR-022: M7 Apps in Toss release
- **Date:** 2026-10-15
- **Status:** Accepted (grows with each M7 step)
- **Context:** M7 ships the quick match as a game mini app in Apps in Toss (토스 앱인토스): a WebView with the
  `@apps-in-toss/web-framework` 3.x SDK, judged against the game launch checklist (developers-apps-in-toss.toss.im
  `checklist/app-game`). The game was built for a desktop browser (1280×720, English, keyboard, IndexedDB). The
  user took every default of the M7 questions: quick match only, portrait, Korean with Pretendard, a platform
  adapter, saves per user key in the SDK storage, no ads or purchases, a sound toggle with background pause and
  haptics, back and concede behind a confirm, a DPR cap with automatic quality steps, SDK 3.x.
- **Decision:**
  - **Two build targets.** `vite --mode toss` (`npm run dev:toss`, `npm run build:toss`) is the Toss build;
    everything else is the web build (dev page, e2e, desktop). `ui/src/target.ts` maps the mode to a target and
    decides per target: the dev replay page (`?seed=`) loads on the web only, the toss build offers the `quick`
    routes only and sends every other route (title, season mode, unknown) to `#/quick`, the web build sends unknown
    routes to the title. The toss build uses relative asset paths (`base: './'`).
  - **Platform adapter.** Screens reach the host through `ui/src/platform` (`Platform`: user key, small key-value
    settings, haptics, back button, close, safe-area insets, portrait lock). `getPlatform()` loads `toss.ts` only in
    the toss build, so the web bundle never contains the SDK; `web.ts` keeps settings in localStorage and treats
    refused storage as empty, has no user key, haptics or back button, and closes to the title.
  - **Tests.** A `toss` Playwright project runs `e2e/toss.spec.ts` against a second Vite server in the toss mode on
    `E2E_PORT + 1`.
  - **SDK (step 2).** `@apps-in-toss/web-framework` 3.7.0 (ui, exact) and `@apps-in-toss/devtools` 3.7.0 (root dev).
    `apps-in-toss.config.ts` names the app `rally-tennis` (must match the console), brand colour `--court`, a
    transparent navigation bar, and no bounce, overscroll, pull-to-refresh or swipe-back. `npm run build:toss` is
    `vite build --mode toss && ait build` and writes `rally-tennis.ait` at the root (git-ignored); `npx ait deploy`
    uploads it for the QR test (the 3.x SDK has no sandbox app). `toss.ts` maps `User.getAnonymousKey`, `Storage`,
    `Device.triggerHaptic`, `graniteEvent` `backEvent`, `Screen.close`, `SafeArea` and `Screen.setOrientation` onto
    `toss-core.ts`, which guards every call: unsupported on this Toss app, a throw, a rejection or no answer within
    `SDK_TIMEOUT_MS` (3 s) falls back to the web behaviour, and the user key is asked for once. The app locks
    portrait at boot. In `vite --mode toss` dev the devtools plugin swaps in its mock SDK (production builds switch
    it off); `AIT_PANEL=0` hides its panel for e2e. The platform module compares the mode inline, so the web build
    has no SDK code (checked by searching `dist/`).
  - **Korean (step 3).** The game's sentences moved into text catalogs, `game/src/text/{en,ko}.ts` (`Messages`):
    card names, flavours, moments, how points end, plans, styles, surfaces, ratings, habits, scouting and rival
    lines, tells, the decisive line, headline, goals and the play-by-play. Views, `decisiveMoment`, `highlightOf`
    and `nextGoal` take a catalog as their last argument, English by default, so the web screens, the tests and
    the e2e text checks are unchanged; `STYLE_LABEL`, `SURFACE_LABEL`, `RATING_LABEL` and `CARD_LABEL` are now the
    English catalog's. A tell is drawn as `{ card, index }` (the index consumes the stream exactly as `pick` did, so
    every seed plays the same) and put in words by the view; nothing saved holds prose, so the save format stays
    v2. Korean lines put a dash after a player's (Latin) name instead of guessing a particle; particles after card
    names come from `withJosa` (받침 test on the last syllable). The UI's own words are `ui/src/i18n/{en,ko}.ts`
    (`UiText`); `LANG` is Korean in the toss build and on the web with `?lang=ko`, English otherwise, and sets
    `<html lang>`. The season mode, the dev replay page, the broadcast graphics (MATCH POINT, the score bug) and the
    umpire's voice stay English (TD-051).
  - **Pretendard.** The author's own subset files (npm `pretendard@1.3.9`, SemiBold and ExtraBold, 2,780 Hangul
    syllables, about 270 KB each) are self-hosted unmodified, as the OFL reserves the name. They join the body and
    display stacks behind Nunito and Lilita One with a Hangul-only `unicode-range`, so Latin and digits keep the
    Rally Pop faces and an English page never fetches them (an e2e test checks); a Korean page preloads both.
  - **Phones (step 4).** The viewport covers the notch (`viewport-fit=cover`) without pinch zoom. `theme.css` has
    `--safe-top/right/bottom/left` (CSS `env()` by default; in Toss `followSafeArea` writes the SDK's insets) and
    `--nav-reserve`, the top-right corner kept free for Toss's close and more buttons (104 px in the toss build,
    0 on the web; `:root[data-target]`). `ui/src/quick/phone.css` (imported last, `max-width: 640px`) lays the
    match out in portrait: the 3D stage is the top 60dvh, the panel is pinned to the bottom and always fills the
    area under the stage (a short reveal sits in its middle, a tall decision panel rises over the stage's edge),
    the three cards stay in one row without key numbers, and the score bug, the broadcast graphics and the sound
    toggle sit on the stage inside the safe area, clear of the Toss corner. The shell header and page pad for the
    safe area and the corner; touch targets are at least 44 px; the result keeps its three tiles side by side.
    Hover lifts and fills only apply under `(hover: hover)` (a touch browser keeps `:hover` on the last tap), the
    result says "탭해서 건너뛰기" / "Tap to skip" on a coarse pointer, and a card's score in "Their cards" is shown,
    not a title tooltip. A `mobile` Playwright project (Pixel 7, touch) checks the toss build for overlaps, side
    scrolling, the Toss corner, touch-target sizes and the stuck hover.
  - **Portrait camera (step 5).** On a 60dvh phone stage (aspect about 0.82) the old rule widened the main camera to
    about 55° vertical from the same spot: sky above, empty surround below, a small court. `mainCamPose(pan,
    aspect)` now moves from the TV angle (aspect 1.4 and wider, unchanged) to `CAMERA.portrait` (reached at 0.82):
    22 m up, 23 m behind the near baseline (beyond the end stand's last tier), looking 5.5 m into the near half,
    with a frame 27° across fitted to the aspect. The values come from a search over 0.70–0.85 aspects at every pan
    that keeps the doubles court and both players inside the frame; with the court across the whole width the far
    ball cannot be drawn wider than about 3.7 px on a 412 px stage, so an upright phone draws it
    `BALL_LOOK.portraitScale` (1.3×) larger (`Stage.setAspect`), about 4.8 px. `fitFov` (renderer/src/camera/
    framing.ts) keeps every camera a minimum width across: the side camera 46°, the close-ups 32°
    (`closeMinHorizontalFov`), the main camera 46° easing to its portrait 27°; nothing changes at 16:9. The viewer
    now rebuilds the projection when the aspect changes too (it only did on a field-of-view change).
  - **Sound, background, haptics (step 6).** The quick match shares one mixer through an audio session
    (`ui/src/audio/session.ts`) instead of each broadcast's slider panel (`mountBroadcast({ audio })`; the replay
    page and the season mode keep their panel, which now closes its mixer even when muted). One on/off setting
    (`tennis-sound` in the platform settings, on by default) is shown by one switch, `#sound-toggle`, on the ladder
    and over the 3D match, left of the Toss corner (icon only on a phone). The mixer is made inside the Play tap or
    the switch's tap (iOS starts audio only from a gesture); a hidden page (`visibilitychange`, `pagehide`)
    suspends the audio context at once, a return resumes it if sound is on, and a resume the browser refuses is
    retried on the next tap. `Mixer` gained `suspend()`, `resume()` and `state`. The plan put the switch on Toss's
    accessory button, but its monotone icon names cannot be checked without a device, so it is an in-screen button
    for now (TD-054). Haptics (`ui/src/lib/haptics.ts`): tap on a pick, success on a read, error on a misread, tap on
    the same card, confetti on a win, basicMedium on a loss; the web platform ignores them. The session imports the
    mixer through a new `@tennis/renderer/audio` entry (package `exports`, allowed in lint), so the first chunk
    still has no Three.js (TD-014); the career e2e check now looks for Three.js and the broadcast modules by path.
  - **User key and saves (step 7).** The web keeps the ladder in IndexedDB. The toss build keeps it in the platform
    settings (the SDK's on-device `Storage`) under `quick:<user key>` (`ui/src/storage/quick-store.ts`, chosen per
    target as `ctx.quickStore`), so each Toss account on a phone has its own ladder. The key is
    `User.getAnonymousKey`, asked for up to `KEY_RETRY` times (3, 400 ms apart) once per session; without one the
    game plays on under `quick:local`. Loading looks for the user's own save, then a `local` one, then the
    browser-era IndexedDB `quick`; a save found in an older place is copied under the user's key and the old copy
    removed, so it moves once. The toss platform forgets a failed key ask, so a retry can still succeed. The save
    format stays QuickSave v2. A save grows about 2.2 KB a match (31 KB new, 254 KB after 100 matches, 472 KB after
    200), all of it rewritten after every match (TD-055). Saves stay on the device: a new phone or a reinstalled
    Toss app starts a new ladder.
  - **Back, exit, concede (step 8).** `concedeQuick(s, m)` (game/src/quick/ladder.ts) ends a match still being
    played as a loss at the score so far: it shares `settle` with `finishQuick` (points, ratings, rival, background
    matches) and records `conceded: true` with an empty fingerprint; the engine is untouched (no event-schema
    change) and the save stays v2 (one optional field). A conceded record has no decisive point (`decisiveMoment`
    and `highlightOf` return null, nothing is replayed) and its headline is `concededHeadline` ("You conceded 3-5"
    / "기권패 3-5"). Conceding is a loss on purpose, so walking off a losing match costs the same. The back button
    (`ui/src/lib/back.ts`, a pure reducer, carried out by `career/back.ts`): an open dialog closes first; in a
    match it asks "기권할까요?" and concedes on yes; from the result it goes to the ladder; on the ladder or the
    start form it asks "게임을 종료할까요?" and closes the mini app (`Screen.close`). The toss build subscribes to
    `graniteEvent` `backEvent` (which blocks Toss's default back); on the web, Escape in a match does the same.
    The dialog (`ui/src/lib/confirm.ts`) is modal with focus on the safe choice, and Escape, a tap outside or
    the back button cancel it. The devtools mock's `__ait.trigger('backEvent')` drives an e2e test of the toss path.
  - **Quality tiers (step 9).** `QUALITY` (renderer/src/tuning/quality.ts) has two tiers: high (pixel ratio up to 2,
    antialiasing, ink outlines, sky dome) and low (pixel ratio up to 1.5, none of the three). A device with 4 or
    fewer logical cores starts low (antialiasing is fixed when the WebGL renderer is made); otherwise a page starts
    high and the viewer's frame meter (renderer/src/quality.ts) steps it down once to low when frames average over
    33 ms across 2 s, after a 1 s warm-up and ignoring gaps over 0.25 s (a hidden tab). The tier lasts the page's
    life across broadcasts, shows as `body.dataset.quality`, and `?quality=low|high` sets the start. Low draws 89
    meshes against 114 at the main camera (no outline hulls) and about 44% fewer pixels at a 2× screen. Measured on
    the dev VM (software WebGL, so only indicative): the toss build, cold, on a Pixel 7 profile with 4× CPU
    slowdown and 9 Mbps / 170 ms: first screen 1.9 s, Play to the first 3D frame 0.9 s (checklist: 10 s); the
    unthrottled VM steps high down to low within seconds, low then holds a 16.7 ms median frame. In a plain browser
    the toss build's first screen takes 1.3 s with the real SDK (the bridge calls fail at once and fall back).
- **Consequences:** Engine and game are untouched by the targets. The toss build is about 61 KB larger (18 KB
  gzip) for the SDK chunk; with Pretendard the `.ait` is 0.87 MB. The first chunk carries the mixer (22 KB,
  9 KB gzip). Untested on a device until the console
  registration (TD-049).

## ADR-023: Player motion track A, step A1: the racket meets the ball
- **Date:** 2026-10-15
- **Status:** Accepted
- **Context:** The M3 mannequin swung a rigid one-piece arm on fixed angles and faced the ball at all times. Measured
  over seeds 1–4 on all surfaces, the racket-head centre missed the engine's contact point (`shot.from`) by a median
  1.21 m on forehands, 0.46 m on backhands and 0.51 m on serves: at contact the ball sits 0.5–1.0 m beside the
  hitter, so facing it turned the body side-on to the sideline with the ball dead ahead; the racket reached a fixed
  1.08 m from the shoulder at a fixed 1.04 m height against balls 0.64–1.36 m high; and serves struck at 2.62–2.94 m
  were out of reach. The user chose track A (procedural upgrades on the current rig, no new assets or dependencies)
  over a skinned CC0 body (B) or authored clips (C); no CC0 pack has tennis strokes (docs/m3-assets-and-references.md),
  so the procedural stroke layer is needed whichever body comes later. A1 is its first step.
- **Decision:**
  - **Renderer only.** The engine already records where every ball was struck, so nothing in the engine, the event
    schema or the game layer changes. Every addition is a closed-form function of replay time (ADR-007): no
    per-frame state, no simulated springs, so seek, replays and speeds stay exact.
  - **Facing at contact.** Within `RIG_MOTION.contactTurnSec` (0.25 s) of their own contact a player turns from the
    ball towards where the shot goes (`from → bounce`, or the far end for a net ball), smoothstep-weighted. The ball
    then sits on the forehand or backhand side.
  - **Elbow and IK.** The racket arm is an upper arm (0.28 m) and a forearm (0.28 m) carrying the racket in line;
    `scene/ik.ts` solves the two bones with the law of cosines, the elbow bending towards `RIG.elbowPole` (down, out,
    back). `scene/arm.ts` holds the arm meshes and the swing maths; the old swing angles survive as a path of
    full-reach targets for the racket-head centre, eased out of and back into the rest position over
    `RIG.swingEase` (15 %) of the swing, which also removed a 1.8 m racket jump at the start and end of every swing.
    Reactions ease in and out over `RIG_MOTION.reactionRampSec` (`PlayerPose.reactionWeight`).
  - **Contact targeting.** `PlayerPose.swing.contact` carries the shot's `from`. The swing path is moved, weighted by
    a smoothstep over `RIG.contactBlend` (35 % of the swing) either side of contact, so it passes through the contact
    point at phase 0.5. For groundstrokes the torso leans sideways (up to `RIG.contactLeanMax`, 0.6 rad) and then the
    hips lunge sideways (up to `RIG.lungeMax`, 0.9 m) to keep the shoulder `RIG.contactReach` (0.85 m) from the ball,
    so the elbow stays bent (about 80–97° at contact) instead of folding flat or locking. Serves jump
    (`RIG.serveJump`, 0.4 m at contact).
  - **Tests.** `renderer/tests/contact.test.ts`: per stroke, the racket-head centre is within 0.15 m of the ball at
    p95 and 0.3 m at worst over the six sample matches; the racket never moves more than 0.7 m on the body between
    60 fps frames. `ik.test.ts` covers the solver.
- **Roadmap (each step approved separately; A2–A5 superseded by ADR-024 on 2026-10-16, their goals moved into its
  stroke planner):**
  - **A2 body and stroke shape:** pelvis and chest split (unit turn, hip–shoulder separation), wrist and racket face,
    head tracking the ball, key poses per stroke (ready, unit turn, backswing, contact, finish), swing start timed
    from the incoming ball's flight instead of a fixed 0.3 s, two-handed backhand.
  - **A3 movement:** stride phase from distance travelled (closed form over the trapezoid easing) to stop foot slide;
    shuffle, crossover or sprint chosen from movement against facing; split-step landing timed to the opponent's
    contact; recovery steps; a blended facing when the ball goes dead (TD-057).
  - **A4 shots from the data we have:** contact height (deep crouch for low balls), `spinRpm` (low-to-high finish),
    `speedKmh` (swing size), the run into the ball (defensive shots). Slices, volleys and the rest need the engine
    first (TD-001).
  - **A5 reactions and character:** reactions by outcome and point tag (fist pump on a winner, racket drop on an
    unforced error, bigger celebrations on break, set and match points), between-point business (bouncing the ball
    before a serve), per-player appearance.
  - Then phase 3's body decision (TD-012, TD-039): the capsule rig or a CC0 chunky body; the A layers carry over.
- **Consequences:** Measured on 12 further matches, groundstrokes now meet the ball exactly and serves within 0.094 m
  at p95 (0.132 m at worst). Each player draws three more meshes (forearm, elbow joint, the forearm's outline): the
  outline budget is now full at 24 (TD-038). The lunge slides both feet and the racket face is uncontrolled (TD-058);
  the body still snapped round when the ball went dead (TD-057), which a follow-up closed: see Facing below.
- **Facing (2026-10-16, TD-057).** `playback/facing.ts` writes the facing as the net direction plus a turn towards
  the ball, so it no longer switches from the ball to the net in one frame. `ballSpans` lists when `ballAt` shows a
  ball; the turn eases in over `RIG_MOTION.facing.settleSec` (0.4 s) when a stretch of play starts and out over the
  same when it ends, a second serve's toss easing in from what is left of the fault. A ball nearer than 0.8 m is not
  followed and one beyond 3 m fully, and a ball behind the player is followed less the further behind it is, so a
  passing winner gets a look over the shoulder instead of a spin. Changing ends, players face their walk (velocity
  over ± 0.3 s, eased over the first and last 15 %), which also hides the net direction flipping as they cross the
  net line. `playerPose` no longer takes the frame's ball. Over eight further matches (1.9 M frames) the fastest
  turn is 0.25 rad per 60 fps frame (was up to π); a test keeps it under 0.35, and the racket continuity test is
  back in world space.


## ADR-024: 3D redesign: game camera, Pop character, effector-key motion, sunny club
- **Date:** 2026-10-16
- **Status:** Accepted (grows with each vertical-slice step)
- **Context:** The user asked for the 3D to be redone from design up (camera, character, motion, look), priority
  motion → camera → character → arena, in a mobile casual tone (Tennis Clash's composition, Mario Tennis Aces'
  exaggeration and impact) with the Rally Pop palette. `docs/3d-redesign.md` diagnosed today's build (the decision
  hold is whatever frame the last clip left, usually Reaction Cam on the last point's winner; the near player is 10%
  of the portrait stage and the far one at changeovers; points play at 2–3×; a faceless capsule mannequin whose lunge
  slides both feet), compared 2–3 options per area with style frames (`docs/design/3d-redesign/`) and recommended a
  set; the user took it.
- **Decision:**
  - **Camera:** a game camera, K2 chase, behind *my* player (6.2 m up, 7.7 m behind the baseline, 48° vertical),
    sampled from the timeline over a window so it stays closed-form in time (ADR-007). Shots: S1 chase, S2 decision
    hold on the opponent's tell, S3 impact close-up with hit-stop and slow motion on decisive shots only, S4 reaction
    close-up, S5 replays with the kept broadcast cameras (Side, Hawk-Eye). Applies to the quick match and the replay
    page; the season mode keeps the broadcast director for now.
  - **Character:** C1 Pop, 3–3.5 heads at full adult height, a readable face, cap or headband; serve reach from a hop
    scaled by contact height plus arm stretch at contact.
  - **Motion:** D2 effector key poses (racket hand, racket direction, free hand, feet, pelvis, chest, crouch, head)
    timed from shot events and solved with A1's two-bone IK onto `shot.from`, planting the front foot instead of
    sliding the hips; CC0 KayKit clips for locomotion and reactions, sampled with `AnimationMixer.setTime`.
  - **Arena:** A1 sunny club; A2 stadium kept for later.
  - **Vertical slice first:** one point (serve, a short rally, a winner, the reaction, a replay) on the replay page
    and the toss build, in steps: body pipeline (KayKit Adventurers, CC0, pruned and committed), effector-key strokes,
    gait and reactions, chase camera and director, impact, the point end to end with phone measurements. The final
    character look (commission, Tripo, or a modified KayKit) is decided from the slice.
  - **Assets and tools:** only CC0 assets in the repo (it is public); a Node script with no new dependency prunes the
    glb; meshopt and gltf-transform only if that falls short (each a separate approval).
- **Consequences:** ADR-023's A2–A5 are superseded; TD-012, TD-039 and TD-058 move to this track. The quick match's
  pacing (TD-060) and its decision-hold frame (TD-061) need game-layer and UI changes outside the renderer slice.
- **Step 1, body (2026-10-16).** `renderer/cli/prune-player.ts` cuts KayKit's Rogue (CC0, repo commit `672074b`) to
  `ui/public/models/player.glb` with `asset/glb.ts`, a dependency-free GLB reader, writer and pruner: six body meshes
  (4,263 triangles), all 41 joints, the 16 KB palette texture and eight in-place clips (Idle, Running_A,
  Running_Strafe_Left/Right, Walking_A, Walking_Backwards, Cheer, Hit_A) with rotation tracks on the 20 deform bones and
  the hips' translation only: 350 KB, credited in `ui/public/models/CREDITS.md`. `scene/playerModel.ts` builds the
  model from those bytes without GLTFLoader (one merged `SkinnedMesh`, the skeleton, the clips; bone names sanitised
  as three's loaders do, `upperarm.r` → `upperarmr`), so tests build exactly what the page draws; only the texture
  decode (`createImageBitmap`) is browser-only. The source is 2.15 heads at 2.19 units; the body keeps its size and
  the head bone (a leaf, so a uniform scale cannot shear) is scaled 0.57, giving 1.78 m and about three heads,
  shoulders at 1.09 m. `GltfRig` implements `PlayerRig`: toon material on the palette, a skinned ink hull
  (`addSkinnedOutline`: the hull keeps skin indices and weights and skins position and normal in its shader), a racket
  on `handslot.r`, a blob shadow, six draws with outlines; Idle, Running_A, Cheer and Hit_A are weighted by speed and
  reaction and sampled with `AnimationMixer.setTime(pose.t)` (`PlayerPose.t` is new), so a pose stays a function of
  time. Opt-in with `?rig=gltf` on the replay page and the quick match; the mannequin stays the default until step 6.
- **Step 2, effector-key strokes (2026-10-16).** `playback/stroke.ts` plans, per player and replay time, the stroke in
  progress from the shot events: keys from `STROKE_KEYS` (forehand, backhand, serve; hand, racket direction, free
  hand, pelvis, chest turn and lean, crouch, in the player's own frame and metres) eased by smoothstep, the
  groundstroke lead-in starting at `max(contact − 0.5 s, incoming contact + 0.15 s)` and the backswing-to-contact
  swing (0.18 s) never compressed, blending in over 0.12 s and out between 0.45 and 0.75 s after contact; the contact
  point in the player's frame with a weight peaking at contact (±0.16 s, a serve ±0.26 s); and the serve hop by rule:
  what the standing reach lacks, within 0.55 m. The standing reach (2.43 m: shoulders 1.09 m, arm × 1.15 stretch,
  racket 0.68 m) is measured on the rig by a test, which also checks that the hop covers a 2.95 m toss.
  `PlayerPose.stroke` carries it. `scene/strokeSolver.ts` puts it on the bones over the clip pose: hips yaw, spine and
  chest turn and lean, crouch and hop on the hips, the legs back onto the clip's feet by two-bone IK, A1's
  `solveTwoBone` for both arms to the hand bone (the wrist held straight), and the hand turned so the racket (along
  the hand slot's +y, strings facing forward) points along its direction; near contact the direction bends towards
  the contact point and the hand target becomes the contact minus the racket's offset in the hand, the arm may
  stretch 15 % (the elbow slides out along the upper arm and the wrist and hand along the forearm: positions, not
  scales; the elbow's mesh is weighted to both bones, so it stretches there), and up to three passes shift the
  whole body (groundstrokes only, ≤ 0.9 m, the feet sliding: TD-058) and crouch up to 0.15 m for what is still
  missed. Over the six sample matches the racket-head centre is within 0.005 m of the contact point on every
  groundstroke and 0.049 m on every serve (median hop 0.35 m, max 0.52 m); the body shift is 0 at the median and
  0.84 m at worst. **AnimationMixer is gone:** it writes a property only when the clip value changed since its last
  update, so a solved bone kept the solver's value on the next frame (0.5 rad on the hips for the same pose drawn
  twice). `scene/clipSampler.ts` samples the clips' interpolants at `pose.t` and blends them (nlerp, the rest pose for
  missing weight) on every apply, which makes every pose a pure function of time again. `ui/rig.html` (dev server
  only, not built) draws one player up close at chosen times around a shot, for tuning keys.
- **Step 3, gait and plants (2026-10-16).** `distanceAt` (`playback/movement.ts`) gives the metres a player has
  moved along the exact eased paths `positionAt` follows (each move's length times its trapezoid share, segment
  offsets cached per timeline), so a locomotion clip's phase is `distance / stride`, closed-form. Strides are
  measured from the clips by a test (the median slide of a foot in stance times the clip length): Running_A 1.91 m,
  Walking_A 0.58 m, Walking_Backwards 0.54 m per cycle. KayKit's "strafe" clips run forward with a twist (their feet
  move 5 mm sideways per cycle), so they were dropped from the model (326 KB, six clips); a sideways or diagonal run
  turns the hips and legs towards the move (up to 1.75 rad) while the spine turns back so the chest keeps facing,
  and further round than 2 rad below 2.5 m/s the player backpedals. Walk and run blend over 1.4–2 m/s only (two
  cycles at their own phases slide the feet). Idle plays at replay time and the reactions from the landing
  (`PlayerPose.reactionT`, held at the end). The split step lifts the whole body. Strokes plant the feet: the
  planner places a stance per stroke (`STROKE.stance`) in the frame the player has at contact (`hitterPos`, facing
  where the shot goes) and fades it in from 0.2 s before contact (a serve from its toss) to 0.15 s after, out by
  0.32 s; the solver draws the clip's feet onto it, and a leg that cannot reach steps its foot in towards the hip.
  `sampleClips` takes per-clip times and aligns quaternions against the rest pose (order-independent). Measured
  per 60 fps frame on a foot in stance: running median 4.5 mm (the clip's own roll), walk median 5 mm, planted
  median 0 with a p95 of 7–8 cm where a reach step drags a foot.
- **Step 4, game camera and director (2026-10-16).** `camera/chase.ts` is K2 as a pure function of the timeline,
  my player and match time: 6.2 m up and 7.4 m behind my player (it follows my depth, in to the net and back behind
  the baseline), 0.75 of my x, aimed 15.8 m down the court from the camera, my x and depth averaged over ± 0.4 s with
  a smoothstep kernel (samples across the net, at a change of ends, are left out; the camera's end switches halfway
  through the changeover). The ball is not followed: a windowed average of a ball that appears and vanishes jumps
  (0.29 m in one frame). Vertical field of view 48° from the phone stage's 0.82 aspect up to a square view, the same
  width across on narrower screens (51.9° at 0.75), easing to 36° by 1.4. Over the first 25 points of three sample
  matches, every 0.25 s of live play at aspects 0.75–0.95, my player fills the bottom third (head never above 66 %
  of the stage height down, feet never below 91.4 %), the far baseline is never above 26.8 % down (clear of the
  score bug), and the opponent stays inside the frame; the camera moves under
  0.25 m and turns under 0.03 rad per 60 fps frame. `cameraTrack(timeline, { style: 'game' })` lays the chase
  through live play, the side camera at changeovers and a close-up (`closeup`, M5) on the winner of a decisive point
  (`isDecisive`: an ace or winner on a big point, a converted break, the last point of a set or match), with no TV
  main or serve camera; `tell` (M2) frames a player from between them and the net. The viewer computes the chase
  (only the TV main camera still pans with per-frame state) and takes a held shot (`Viewer.hold`, `Broadcast.hold`,
  `heldShot`): with `?rig=gltf` the quick match holds the tell on the opponent while the cards are up and plays its
  decision clips at 1× for the preview (production pacing is TD-060). `CameraShot` is exported for the ui.
- **Step 5, impact (2026-10-16).** In the game style `buildProgramme` splices the impact moment into live play on
  the deciding ace or winner of a decisive point, never on two shown points in a row: slow motion at 0.25 from 0.15 s
  before the contact, a hit-stop (a 0.07 s still, `rate` 0) at it, slow motion to 0.35 s after it, then live again
  (`BROADCAST.impact`; clip kinds `slowmo` and `hitstop`, camera `impact`). The quick match's bare programme gets
  it too. Cues treat `slowmo` and `hitstop` as live: a rate-0 clip plays the cues that fall exactly on its moment,
  and each live cue plays once per pass, so the deciding hit sounds as the hold begins. `programmeTimeFor` still
  finds live clips only, so a seek or window start inside the moment lands after it (the quick match's windows all
  start earlier). `camera/impact.ts` holds the camera still for the whole moment, 3.2 m along the shot from the
  contact and 1.8 m to the racket side, aimed at the contact (aiming at the ball lost the player as soon as it left).
  `scene/impact.ts` adds a star and speed lines as two sprites on textures computed in code, at the contact,
  blooming over the hold by clip time (`BroadcastFrame.clipT`, new: match time stands still there) and fading through
  the slow motion; the ball is squashed along the shot over the hold and 0.08 s after it, replacing the contact pop.
  The replay tag's corner reads `SLOW-MO` meanwhile. Racket smear, trail colours by shot and a hit-stop shake are
  left (TD-063).
- **Step 6, the slice end to end (2026-10-16).** The quick match reloads its timeline into the same viewer as the
  match grows; the chase and impact cameras (and the stage's trail, pop and impact) read the first timeline and the
  impact camera threw on a new point, so `Viewer.setTimeline` and `Stage.setTimeline` now follow it (a test grows a
  stage). The page reports draws and triangles in `body.dataset` (`Viewer.stats`). Measured on the dev VM's software
  WebGL at 412×503 (DPR 2), indicative only: at the live camera 70 draws and 18.5k triangles with the slice against
  112 and 5.4k today (low tier 62 / 9.3k against 88 / 2.9k); 39–41 fps against 50–52 at high tier, 60 (capped) on
  low either way; the model is 151 KB gzipped (meshopt not needed yet) and adds about 60 ms from the Play tap to the
  first frame on the toss dev server. `npm run test:e2e`: 45 passed (slice off). Phone and desktop-GPU frame times
  are TD-059's. The slice becomes the default (`?rig=gltf` off → on) once TD-059 is measured, TD-060's pacing and
  TD-062's kits are in, and the user accepts the look; docs/3d-redesign.md §9 lists what is left. The user set the
  B200 host aside for asset generation (TRELLIS, FLUX.1-schnell; docs/3d-redesign.md §8).
- **Step 6, desktop GPU (2026-10-16).** On the i5-14600KF + RTX 5060 desktop (WSL2), headless Chromium reaches the
  GPU through ANGLE's GL ES backend on Mesa's d3d12 driver (`--use-angle=gl-egl`, `GALLIUM_DRIVER=d3d12`; without
  them it is llvmpipe or SwiftShader). `e2e/perf/frames.ts` plays the replay page with and without `?rig=gltf` at
  each tier and reports frame times, draws and triangles per camera. Every case holds 60 fps with vsync, also at
  Pixel 7 size with the main thread slowed 6×; uncapped, the median frame is 1.1 ms with the slice against 0.9 ms
  today at high tier (1.0 against 0.7 at low), with at most 74 draws / 19.3k triangles at the chase camera against
  116 / 6.1k at today's main camera. The desktop half of TD-059 is done; the phone half decides whether high stays
  the phone default (docs/3d-redesign.md §9).
- **After the slice: the game pace (TD-060, 2026-10-16).** `game/src/quick/pace.ts` takes a `PaceStyle`: `'tv'`
  (today's sped-up clips, the default) or `'game'`, which the quick match uses with `?rig=gltf`. The game pace plays
  every point at 1× (`clipSpeed`) and shows less of it (`clipFor(p, 'game')`): a decision point from 0.7 s before
  its third-last contact, a point without cards from 0.7 s before its last (the toss when that contact is the serve),
  still capped at `keyMaxSec`. The pace model counts the impact moment's 1.57 s where the renderer splices it in
  (`showsImpact`: an ace or winner on a big or decisive point, not right after another); a ui test checks that rule
  and those seconds against the bare game-style programme over 40 tiebreaks, since the game layer cannot import the
  renderer. Median screen time over 2,000 matches: 43 s at the game pace, 23 s at the TV pace (target ≤ 60 s;
  `npm run quick` and `test:quick` report and guard both).
- **After the slice: the tell stance (TD-061, 2026-10-16).** The decision hold no longer freezes the last frame of
  the previous point (in captures, the opponent mid-cheer). `Viewer.hold` takes a `HoldShot`: with `ready`, both
  players stand where the next point will start (`readyPositions`: the server by the centre mark, the receiver wide
  and deep, on the ends they will play from, in the deuce or advantage court by the score's parity; checked against
  where the engine really starts the next point in three tiebreaks and an exhibition match) in a ready stance, and
  the opponent's body shows the tell: one `StanceCue` per tell text (`HOLD_STANCES`, renderer/src/tuning/stances.ts;
  depth, lean, drop, arms, a side-to-side sway, an in-and-out step or a bounce), solved by the stroke solver as a
  stroke with no contact. The idle and any sway run on the hold's own seconds, so match time stays still. Timeline
  segments gained `changesEnds` (a changeover after the point, also at a set's end). The ball is out of play during
  the hold. `/rig.html?point=15&hold=none,defend:1,counter:2` draws the stances for tuning.

