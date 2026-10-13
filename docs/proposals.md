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

## P2. Opponents who remember you (TD-034)

**Finding.** On the quick ladder, 42% of matches are rematches. The first one comes at match 6 (median; 30 ladders of
30 matches, reader bot). The rival line already shows the opponent's past cards, but the AI ignores the record. A
rematch plays exactly like a first meeting, apart from what the player remembers.

**Options.**
- **A. A counter-read in rematches (recommended).** An opponent who lost big points to one of your cards shifts its
  off-habit mix toward the card that beats it, at most +0.15 share. The rival line says so ("Cortley remembers your
  counters"). The habit stays the main read, and the counter-read gives the player a second-order guess to make. A
  new target would guard it: "knows the habit" stays ≥ 62%, and a bot that ignores the rival line loses about 2–4 pp
  in rematches.
- **B. Escalating habits.** A rival's habit strengthens each meeting (habit share 0.72 → 0.8). Easier to read, but
  rematches get easier, which is the opposite of a rivalry.
- **C. Leave it.** Rematches are a memory test for the player only.

**Default:** A.

## P3. A reason for "one more" right after a win

**Finding.** The result screen ends with the next goal ("2 wins to Top 32") and Play again. Nothing marks a run of
wins, and wins and losses look alike on the ladder home apart from W/L in the recent list. The 기획서 asks for a
visible reward after every match. Something rises after 100% of wins and 53% of losses (ADR-017), but there is no
short-term chain.

**Options.**
- **A. A visible win streak, no bonus (recommended).** "3 in a row" on the result and the ladder home, with a stamp at
  3 / 5 / 10, and the best streak kept in the save. It costs no balance: ladder points don't change.
- **B. Streak bonus points.** +10% ladder points per win in a streak, capped at +30%. Makes the climb faster
  (TD-026 inflation) and needs the climb target re-tuned.
- **C. Daily challenge.** A seeded opponent of the day with a fixed habit; the same for everyone later, when there is a
  server. Bigger, and it fits the multiplayer stage better.

**Default:** A now, C with the server.

## P4. A guided first match (rest of TD-027)

**Finding.** A one-time tip now explains the cycle, the scouting line and the tell at the first decision. The first
opponent's habit is random, though, so the first lesson may be a hard one (`repeat_card`, `beat_user_last`) rather than
one the player can see at once.

**Options.**
- **A. A fixed first opponent (recommended).** The first ladder match is always against a `big_point_attack` persona.
  At each decision the tip names what the habit predicts ("They attack at match point; Defend beats Attack"). It is
  shown for that match only. The match is still played and still counts.
- **B. A separate tutorial match** before the ladder, with scripted points. More control, more code, and it delays the
  first real match.
- **C. Keep the tip as it is.**

**Default:** A.
