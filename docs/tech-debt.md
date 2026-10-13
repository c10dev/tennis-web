# Tech Debt Tracker

| ID | Area | Description | Impact (L/M/H) | Added | Plan / Owner | Status |
|----|------|-------------|----------------|-------|--------------|--------|
| TD-000 | example | Describe the shortcut taken | L | YYYY-MM-DD | Fix in next refactor pass | open |
| TD-001 | engine/point | Only serve, return and drive exist. Volley, overhead, slice, lob, drop shot and net approach are not modelled; `Tactic.netApproach` and the volley/overhead/slice/dropShot ratings have no effect. | M | 2026-10-13 | Add net play and touch shots after M1 | open |
| TD-002 | engine/player | GDD dynamic state `confidence` and `momentum` is not modelled; only fatigue and pressure exist. `strength` and `injuryProneness` are unused. | M | 2026-10-13 | Add with the management loop (M4) | open |
| TD-003 | engine/match | Tactics are fixed for the match. `tactic_change` is in the schema but never emitted; GDD §2 asks for instructions between sets. | M | 2026-10-13 | Add a per-set tactic plan before M4 | open |
| TD-004 | engine/point | Every player is right-handed and shot direction is only forehand / backhand / middle; GDD's cross / line distinction is not modelled. | L | 2026-10-13 | Revisit with M2 visuals | open |
| TD-005 | engine | Determinism is checked on one JS engine (Node 24). `Math.exp` / `Math.log` may differ in the last bits between engines, so a browser replay of a seed is not proven identical. | M | 2026-10-13 | Add a cross-engine fingerprint check when the M2 renderer runs in a browser | open |
| TD-006 | engine/geometry | Presentation geometry is per shot: player positions are placed near each bounce without movement limits between shots. Measured in the M2 replay (20 matches, eased between shots): running speed p50 0, p90 4.9, p99 9.1, max 14.9 m/s; 2.1% of in-point frames run faster than 8 m/s (tour players top out around 6–7). Worst case is the returner, who starts 0.3–2 m behind the baseline and contacts 1.5–3.5 m behind the bounce. | M | 2026-10-13 | M3: limit `chasePosition` by the time available (geometry ranges only, so RNG draws and results stay identical) | open |
| TD-007 | engine/point | No lets and no `net` outcome; net errors appear only as `netClearance < 0`. | L | 2026-10-13 | Add if the broadcast needs net-cord moments | open |
| TD-008 | tuning | Grass hold (81.2%) sits close to its 80% floor because a higher hold pushes the tiebreak rate past 25%. Big server beats an average player 78% of the time on serve ratings alone. Both are design-target choices, not measured data. | L | 2026-10-13 | Recheck against real tour data (GDD §11) | open |
| TD-009 | engine/match | A best-of-3 match JSON is about 0.7 MB. | L | 2026-10-13 | Compact encoding for save/load (M4) | open |

## Refactor passes
- (record date + what was cleaned up)
- 2026-10-13 (end of M1): moved the batch loop into `runBatch` and the rating ladder player into `ratedPlayer`, both shared by the CLI and `test:stats`. Batch reports are byte-identical before and after. Reviewed TD-001–TD-009: all stay open for M2–M4; none blocks M1.
