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
- **A. The engine gives risk a best level per matchup (recommended after B failed).** Errors from aggression cost
  more against strong defenders (counter-punchers, high defence ratings), so aggressive pays against weak defenders and
  defensive pays against big hitters. This is closest to real tennis. But it is an engine change: the season balance
  (M4) and the M1 batch targets need a re-check, and the engine goldens change.
- **B. The plan carries into the big points.** Each plan also scales the user's card strengths at
  decision points. Aggressive: Attack ×1.15 and Defend/Counter ×0.9. Defensive: the reverse. Balanced: no change.
  The extra points that aggressive wins without cards are then paid back by weaker Defend and Counter when the
  opponent's habit calls for them. The effect is readable: the strength bars on the cards already show it. Needs a
  small engine input (a per-player card-strength multiplier in the match config, schema v6, ADR) and a new target:
  "plans within 3 pp overall, and each plan best against at least one AI style".
- **C. Narrow the aggression levels.** No engine change, but the plans barely matter.
- **D. Leave it** and say so on the plan line ("Aggressive: more winners, more errors").

**Tried and measured: B does not work (2026-10-14).** A prototype added an engine `cardScale` (schema v6) and had the
plans scale the user's cards. The card strengths changed as intended: aggressive Attack 1.36 / Defend 0.75 against
balanced 1.18 / 0.88. Win rates barely moved, though. Over 6,000 matches per plan, the spread with random cards was
5.7–5.8 pp (6.3 without), whether the plans traded Attack against Defend/Counter or scaled every card by ×0.8 to ×1.2.
For the reader bot the spread was 3.6–3.9 pp. The reason is that card strength enlarges won and lost matchups alike, so
it cancels for anyone who reads no better than chance. The prototype was dropped.

**Default (revised):** A, the engine's risk model, because it is the only option that changes the cardless points
where the gap comes from. It needs the season and M1 targets re-checked. Until then, D: say so on the plan line.

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

**Built for review** on the local branch `proposal/p2-rival-memory` (not merged): `RivalRecord.yours` (the user's
big-point cards against that rival, optional so old saves load), the AI reading them with this match's cards
(`decisionOdds`, same +0.15 lean as within a match), and "; remembers your counters" on the rival line. Measured over
60 ladders × 30 matches: a bot that always plays Counter wins 40.5% of rematches on main and 38.7% here (first
meetings 43%); the reader bot is unchanged (51% in rematches). The effect is small by design (the habit stays the
main read); raise `QUICK_AI.adapt` for rivals if playtests want rematches to bite harder.

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

**Built for review** on the local branch `proposal/p3-win-streak` (not merged): `winStreak` over the history (no save
change), the pill on the result and the ladder home, stamps at 3 / 5 / 10, unit tests and an e2e (seed 9 wins twice).

## P4. A guided first match (rest of TD-027)

**Finding.** A one-time tip now explains the cycle, the scouting line and the tell at the first decision. The first
opponent's habit is random, though, so the first lesson may be a hard one (`repeat_card`, `beat_user_last`) rather than
one the player can see at once.

**Options.**
- **A. A fixed first opponent (recommended).** The first ladder match is always against a `defend_unless_behind`
  persona: it applies at 52% of first decisions and 59% of all, against 0% and 45% for `big_point_attack`. At each
  decision a note names what the habit predicts ("Their habit says defend here: Attack beats Defend"), or that the tell
  is the read. It is shown for that match only. The match is still played and still counts.
- **B. A separate tutorial match** before the ladder, with scripted points. More control, more code, and it delays the
  first real match.
- **C. Keep the tip as it is.**

**Default:** A.

**Built for review** on the local branch `proposal/p4-guided-first-match` (not merged): a fixed first-opponent habit
(`QuickState.tutor`, optional), the prediction at every decision of match one, tests and refreshed baselines.

## P5. What happens after the top of the ladder (TD-026, TD-035)

**Finding.** Ten 300-match ladders with the reader bot (seed 4) give these averages:

| After matches | Rank | Points | Top points | Level |
|---|---|---|---|---|
| 0 | 45.8 | 100 | 1,600 | 12.66 |
| 30 | 25.7 | 439 | 1,633 | 12.74 |
| 100 | 11.6 | 1,086 | 1,714 | 13.76 |
| 200 | 2.5 | 1,929 | 2,063 | 15.09 |
| 300 | 1.6 | 2,675 | 2,830 | 16.21 |

Only the user grows, and points never decay, so the climb ends around match 200. At about 1.5 minutes a match that is
roughly five hours of play, and after it the player out-levels the ladder with nothing left to chase. The 기획서's long
loop is "points to the next rank always visible" and continuous growth.

**Options.**
- **A. Divisions (recommended).** The ladder is one division. Finishing a run of matches in the top 8 promotes the
  player to the next division: a new 64-player world a level higher, and points reset to that division's scale. The
  bottom 8 can be relegated. Growth never runs out, and the "next goal" line becomes "Top 8 for promotion".
- **B. Seasons.** Every 50 matches a season closes: points halve, the season rank goes into a history, and AI players
  age and grow (the season mode's ageing already exists). Keeps one ladder, but it is a softer reset.
- **C. Cap growth.** Slow rating gains near the top of the scale and let points decay. Simplest, but the end state is
  still "#1, nothing to do".

**Default:** A. P3's streaks and P2's rivals carry over into each new division.
