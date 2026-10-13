# M6 workstreams (ADR-017)

M6 is built by three parallel sessions on top of the contract commit. Each owns a set of files; touching another
stream's files needs a message to the coordinating session first. Shared types live in `game/src/quick/types.ts`;
changing them is a coordination change too.

The spine already works end to end: a ladder match is one tiebreak (`TIEBREAK_RULES`); `autoPlay(m)` plays points
without cards up to the next decision point (`isDecisionPoint`), where the AI has already chosen (`m.pending`, from
`aiDecision`); `decide(m, card)` plays that point; `finishQuick` records `decisions`. The balance harness
(`game/src/quick/balance.ts`) drives bots through the same calls. `npm run quick` prints three sections; targets
not built yet show `—` (info); `test:quick` has `it.todo`s for them.

| Stream | Goal | Owns |
|---|---|---|
| ① flow | Decision points 3–5 a match, the game plan, quick ticking of points without cards, decision-point clips, matchup weight +20–30 pp | `game/src/quick/{match,moments,plan,pace,balance}.ts`, `game/cli/quick-flow.ts`, `game/tests/quick-flow*.ts`, `engine/src/tuning.ts` (CARDS values only), tuning blocks `TIEBREAK_RULES`, `QUICK_MOMENTS`, `QUICK_PLAN`, `QUICK_PACE`, `game/src/views/quick-match.ts`, `ui/src/quick/{match.ts,quick-match.css}`, the plan picker in `ui/src/quick/home.ts`, `e2e/quick.spec.ts` |
| ② read | Personas with one habit each, tells, scouting, rival memory (quick save v2), no dominant card across opponents | `game/src/quick/{ai,persona,bots,rivals,save}.ts`, `game/cli/quick-read.ts`, `game/tests/quick-read*.ts`, `game/tests/quick-ai.test.ts`, tuning blocks `QUICK_AI`, `QUICK_PERSONA`, `game/src/views/quick-scout.ts`, `ui/src/quick/{scout.ts,quick-scout.css}`, the scouting line in `ui/src/quick/home.ts`, `e2e/quick-scout.spec.ts`, one `recordRival` call in `finishQuick` |
| ③ result | Decisive-point replay with the choice named, overtakes, whole-number ratings (0–100), next goal, animated reveal | `game/src/quick/{rewards,highlight}.ts`, `game/cli/quick-result.ts`, `game/tests/quick-result*.ts`, tuning blocks `QUICK`'s reward fields and `QUICK_REWARD`, the record fields `finishQuick` adds for the result, `game/src/views/quick-result.ts`, `ui/src/quick/{result.ts,quick-result.css}`, `e2e/quick-result.spec.ts` |

Shared and expected to need small merges: `game/src/quick/ladder.ts` (② a call, ③ record fields), `game/src/index.ts`
(exports), `ui/src/quick/home.ts` (① plan picker, ② scouting line), `docs/decisions.md` (each stream appends its
numbers under ADR-017 in its own sub-bullet), `docs/tech-debt.md` (append rows; take the next free number and
prefix the area with the stream, e.g. `game/quick (flow)`).

Rules for every stream: test first, then implement; `npm test`, `npm run typecheck`, `npm run lint` clean at each
commit; e2e with your own port (`E2E_PORT=5181|5182|5183 npm run test:e2e`); determinism (no `Math.random`, no
`Date` in engine/game); one local commit per step on your branch, no push, no attribution lines; heavy runs
(`npm run quick -- --n 2000`, `test:stats`) only at the end of a step; the machine is shared.
