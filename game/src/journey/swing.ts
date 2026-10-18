// "구간 진행" (ADR-032/033): plays one swing for a whole room. Events go in week order; each human enters the ones
// their plan names (straight in, through qualifying, on a wild card, or not at all) with their condition tracked week
// by week; then growth and each human's books (settle.ts), and the year's turnover after the last swing.
import { stream } from '../rng.ts';
import { JTIERS, SWINGS } from './calendar.ts';
import { afterEvent, endSwing, restUntil, startCondition, type Care, type Condition } from './condition.ts';
import { playCup } from './cup.ts';
import { buildDraw } from './draw.ts';
import { aiFields, eligible, entryOf, qualifies } from './entry.ts';
import { queueChoices } from './events.ts';
import { growAi } from './growth.ts';
import { validatePlan, type Plan } from './plan.ts';
import { playEvent, type HumanInPlay } from './play.ts';
import { order, rankOf, recordSwing } from './ranking.ts';
import { assign, solo, view, worldOf } from './room.ts';
import { settle } from './settle.ts';
import { agency, care, changeTeam } from './staff.ts';
import type { EventResult, JourneyState, JPlayer, RoomState, SwingReport, UserState } from './types.ts';
import { yearEnd } from './year.ts';

export interface RoomOutcome {
  room: RoomState;
  /** Each human's report, by player id. */
  reports: Record<string, SwingReport>;
}

interface Side {
  start: UserState;
  plan: Plan;
  care: Care;
  wildcard: boolean;
  playing: boolean;
  rank: number | null;
  juniorRank: number | null;
  cond: Condition;
  results: EventResult[];
  skipped: string[];
}

/** Plays the room's next swing with a plan for every human still playing (a missing plan is an empty one). */
export function advanceRoom(r: RoomState, plans: Readonly<Record<string, Plan>>): RoomOutcome {
  const key = `${r.year}/${r.swing}`;
  const ids = r.order.filter((id) => r.humans[id]!.user.stage !== 'retired');
  const sides = new Map<string, Side>();
  for (const id of ids) {
    const v = view(r, id);
    if (v.pending.length) throw new Error(`Choices are waiting for ${v.user.player.name}`);
    const plan = plans[id] ?? { events: [], focus: v.user.focus };
    const errors = validatePlan(v, plan);
    if (errors.length) throw new Error(`${v.user.player.name}'s plan cannot be played: ${errors.join(', ')}`);
    const start = changeTeam(v.user, r, plan.hire ?? [], plan.release ?? []);
    const p = start.player;
    sides.set(id, {
      start, plan, care: care(start.team), playing: start.injury === 0,
      wildcard: start.wildcard === true || stream(r.seed, 'wildcard', key, id).next() < agency(start.team, start.reputation).wildcard,
      rank: rankOf(p, r.pros, r.points), juniorRank: start.stage === 'junior' ? rankOf(p, r.juniors, r.juniorPoints) : null,
      cond: startCondition(p.fatigue), results: [], skipped: [],
    });
  }
  const events = [...SWINGS[r.swing]!.events].sort((a, b) => a.week - b.week || (a.id < b.id ? -1 : 1));
  const { fields, proPlace, jrPlace } = aiFields(r);
  const earned = new Map<string, number>();
  const earnedJr = new Map<string, number>();
  const add = (into: Map<string, number>, from: Map<string, number>) => from.forEach((v, k) => into.set(k, (into.get(k) ?? 0) + v));
  const humansPro = ids.filter((id) => sides.get(id)!.start.stage === 'pro');
  const player = (id: string): JPlayer => sides.get(id)!.start.player;
  for (const ev of events) {
    const junior = JTIERS[ev.tier].junior;
    const place = junior ? jrPlace : proPlace;
    let field = fields.get(ev.id)!;
    let entering: string[];
    if (ev.tier === 'finals') {
      const everyone = [...r.pros, ...humansPro.map(player)];
      const top = order(everyone, recordSwing(r.points, r.swing, earned, everyone.map((p) => p.id))).slice(0, JTIERS.finals.draw);
      entering = humansPro.filter((id) => top.includes(id) && sides.get(id)!.playing && sides.get(id)!.cond.hurt === 0);
      const byId = new Map(r.pros.map((p) => [p.id, p]));
      const aiTop = order(r.pros, recordSwing(r.points, r.swing, earned, r.pros.map((p) => p.id)));
      field = aiTop.slice(0, JTIERS.finals.draw - entering.length).map((pid) => byId.get(pid)!);
    } else {
      entering = ids.filter((id) => {
        const sd = sides.get(id)!;
        if (!sd.playing || sd.cond.hurt > 0 || !sd.plan.events.includes(ev.id) || !eligible(ev, sd.start.stage, player(id).age)) return false;
        const entry = entryOf(ev, junior ? sd.juniorRank : sd.rank, field, place, sd.wildcard);
        const ok = entry === 'direct' || (entry === 'qualifying' && qualifies(ev, player(id), stream(r.seed, 'qualifying', key, ev.id, id)));
        if (!ok) sd.skipped.push(ev.id);
        return ok;
      });
    }
    const humans = new Map<string, HumanInPlay>();
    for (const id of entering) {
      const sd = sides.get(id)!;
      sd.cond = restUntil(sd.cond, ev.week, sd.care);
      humans.set(id, { morale: sd.start.morale, fatigue: sd.cond.fatigue });
    }
    const draw = buildDraw(r.seed, key, ev, field, entering.map((id) => ({ player: player(id), rank: junior ? sides.get(id)!.juniorRank : sides.get(id)!.rank })), place);
    const played = playEvent({ seed: r.seed, key, humans, rankOf: (pid) => proPlace.get(pid) ?? jrPlace.get(pid) ?? null }, ev, draw);
    add(junior ? earnedJr : earned, played.earned);
    for (const [id, result] of played.results) {
      const sd = sides.get(id)!;
      sd.results.push(result);
      sd.cond = afterEvent(sd.cond, ev, result.matches.length, player(id), stream(r.seed, 'condition', key, ev.id, id), sd.care);
    }
  }
  const fit = ids.filter((id) => sides.get(id)!.playing && sides.get(id)!.cond.hurt === 0)
    .sort((a, b) => (sides.get(a)!.rank ?? 1e9) - (sides.get(b)!.rank ?? 1e9) || (a < b ? -1 : 1));
  const cup = playCup(r.seed, key, r.swing, fit.map(player), new Map(fit.map((id) => [id, { morale: sides.get(id)!.start.morale, fatigue: sides.get(id)!.cond.fatigue }])),
    (pid) => proPlace.get(pid) ?? null);
  const points = recordSwing(r.points, r.swing, earned, [...r.pros.map((p) => p.id), ...ids]);
  const juniorIds = ids.filter((id) => sides.get(id)!.start.stage === 'junior');
  const juniorPoints = recordSwing(r.juniorPoints, r.swing, earnedJr, [...r.juniors.map((p) => p.id), ...juniorIds]);
  const world = { ...worldOf(r), pros: r.pros.map((p) => growAi(p, r.seed, r.year)), juniors: r.juniors.map((p) => growAi(p, r.seed, r.year)), points, juniorPoints };
  let room: RoomState = { ...r, ...world };
  const reports: Record<string, SwingReport> = {};
  for (const id of ids) {
    const sd = sides.get(id)!;
    const end = endSwing(sd.playing ? sd.cond : { ...sd.cond, fatigue: 0 }, sd.care);
    const out = settle(view(r, id), { ...view(room, id), ...world }, {
      plan: sd.plan, user: sd.start, results: sd.results, skipped: sd.skipped, end,
      cup: cup?.lines.has(id) ? { matches: cup.lines.get(id)!, champion: cup.winner === id } : null, rankBefore: sd.rank, juniorRankBefore: sd.juniorRank, withUser: true,
    });
    room = assign(room, id, out.state);
    reports[id] = out.report;
  }
  room = r.swing === 3 ? yearEnd(room) : { ...room, swing: r.swing + 1 };
  for (const id of ids) room = assign(room, id, queueChoices(view(room, id)));
  return { room, reports };
}

/** One player's swing (a room of one). */
export function advanceSwing(s: JourneyState, plan: Plan): { state: JourneyState; report: SwingReport } {
  if (s.user.stage === 'retired') throw new Error('The career is over');
  const id = s.user.player.id;
  const out = advanceRoom(solo(s), { [id]: plan });
  return { state: view(out.room, id), report: out.reports[id]! };
}
