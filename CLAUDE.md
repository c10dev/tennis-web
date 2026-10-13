# CLAUDE.md

## Project
Tennis management sim (Football Manager-style) with TV-broadcast-style 3D match viewing.
- `engine/` — headless, deterministic TypeScript sim → emits `MatchEvent[]` (point/shot level)
- `renderer/` — Three.js replay of events (broadcast cams, replays, score bug, audio)
- `ui/` — menus, management screens, DOM overlays
- Full design: `GDD.md` (Korean). Current milestone: **M1 (engine + tests)**.

## Stack
Vite + TypeScript (strict) + Three.js · Vitest · npm workspaces

## Commands
```
npm install
npm run dev          # Vite dev server (renderer/ui)
npm test             # Vitest (all)
npm run test:engine  # engine tests only
npm run sim -- --n 10000 --seed 42 --surface hard   # batch sim stats report
npm run typecheck && npm run lint
```
(Create these scripts if missing.)

## Folder map
```
engine/    src/{rng,scoring,point,match,tuning.ts,types.ts} tests/
renderer/  src/{scene,camera,playback,audio,overlay}
ui/        src/
docs/      decisions.md, tech-debt.md
GDD.md     game design doc
```

## Rules
1. `engine/` must NOT import from `renderer/` or `ui/`, nor use DOM/Three.js. Renderer consumes events only.
2. Determinism: never use `Math.random()` or `Date.now()` in engine. Inject a seeded RNG. Same seed + input = identical events.
3. Engine work is test-first: write failing Vitest test, then implement.
4. Keep files small (~200 lines max) and functions focused. Prefer pure functions.
5. All tuning constants live in `engine/src/tuning.ts`.
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
- `docs/decisions.md` — architecture decision log
- `docs/tech-debt.md` — debt tracker
