# CLAUDE.md

## Project
Tennis management sim (Football Manager-style) with TV-broadcast-style 3D match viewing.
- `engine/` — headless, deterministic TypeScript sim → emits `MatchEvent[]` (point/shot level)
- `renderer/` — Three.js replay of events (broadcast cams, replays, score bug, audio)
- `game/` — headless, deterministic career layer (world, calendar, training, season, saves) on the engine
- `ui/` — menus, management screens, DOM overlays
- Full design: `GDD.md` (Korean). Current milestone: **M7** (Apps in Toss release, ADR-022); M1–M6 are done (M5: casual quick match, see `docs/casual-design.md` and GDD §13; M6: playtest redesign, ADR-017, GDD §14).

## Stack
Vite + TypeScript (strict) + Three.js · Vitest · npm workspaces

## Commands
```
npm install
npm run dev          # Vite dev server: career game at /, replay page at /?seed=42&surface=clay&mode=full|key|highlights|result
npm run build        # production build to dist/
npm run dev:toss     # the Apps in Toss build (quick match only, ADR-022); build:toss for dist/
npm test             # Vitest: engine + game + renderer (test:stats and test:season for the slow balance checks)
npm run test:engine  # engine tests only
npm run test:renderer
npm run test:game
npm run season -- --n 50 --seed 1   # season balance report (M4 targets)
npm run quick -- --n 2000 --seed 1  # quick-match balance report (M5 targets); test:quick guards it
npm run test:e2e     # Playwright (Chromium) against the dev page; not part of npm test
npm run sim -- --n 10000 --seed 42 --surface hard   # batch sim stats report
npm run sim -- --fingerprint --seed 42 --surface clay   # hash to compare with the replay page
npm run -s sim -- --replay --seed 42 --surface clay > replay.json   # replay JSON for the page's loader
npm run typecheck && npm run lint
```
(Create these scripts if missing.)

## Folder map
```
engine/    src/{rng,scoring,point,match,tuning.ts,types.ts} tests/
game/      src/{world,player,calendar,tournament,season,save,quick,views,tuning.ts} cli/ tests/
renderer/  src/{playback,broadcast,scene,camera,overlay,audio,tuning/,viewer.ts} tests/
ui/        index.html src/{career,quick,replay,lib,storage,platform}   (Vite root)
e2e/       Playwright specs (playwright.config.ts at the root)
docs/      presentation-spec.md (current presentation rules), decisions.md, tech-debt.md, casual-design.md (2026-10-13 design brief, newer than the GDD), 3d-redesign.md, m6-workstreams.md
GDD.md     game design doc
```

## Rules
1. `engine/` and `game/` must NOT import from `renderer/` or `ui/`, nor use DOM/Three.js. Renderer consumes events only.
2. Determinism: never use `Math.random()` or `Date.now()` in engine or game. Inject a seeded RNG. Same seed + input = identical events.
3. Engine work is test-first: write failing Vitest test, then implement.
4. Keep files small (~200 lines max) and functions focused. Prefer pure functions.
5. All tuning constants live in `engine/src/tuning.ts`, `game/src/tuning.ts` and `renderer/src/tuning/`.
6. Event schema changes: update types, bump `schemaVersion`, note in decisions.md.
7. Log notable decisions in `docs/decisions.md` (ADR format).
8. Log shortcuts/known issues in `docs/tech-debt.md` instead of leaving silent TODOs.
9. Periodic refactor: at the end of each milestone (or every ~5 features), review tech-debt.md and refactor.
10. Ask before adding dependencies. Plan before large changes.

## Done criteria (every task)
- [ ] Tests written first & passing (`npm test`)
- [ ] `npm run typecheck` and lint clean
- [ ] Determinism test still passes
- [ ] No engine → renderer/ui imports
- [ ] For sim changes: batch stats within GDD M1 tuning ranges
- [ ] decisions.md / tech-debt.md updated if relevant
- [ ] Short summary of what changed and what's next

## Docs
- `GDD.md` — vision, sim model, scoring, event schema, broadcast spec, milestones
- `docs/presentation-spec.md` — **current rules** for camera, match flow and editing, layout and sound cues; change it first, then code (the source of truth for what the quick match shows)
- `docs/decisions.md` — architecture decision log
- `docs/tech-debt.md` — debt tracker
