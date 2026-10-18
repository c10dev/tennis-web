// "구간 진행" (ADR-032/033): plays one swing for the whole world. Events go in week order; the user enters the ones
// their plan names (straight in, through qualifying, or not at all) with their condition tracked week by week; then
// growth and the books (settle.ts), and the year's turnover after the last swing.
import { stream } from '../rng.ts';
import { JTIERS, SWINGS, type JEvent } from './calendar.ts';
import { afterEvent, endSwing, restUntil, startCondition, type Condition } from './condition.ts';
import { aiFields, eligible, entryOf, qualifies, rankFor } from './entry.ts';
import { queueChoices } from './events.ts';
import { growAi } from './growth.ts';
import { validatePlan, type Plan } from './plan.ts';
import { playEvent, type EventContext } from './play.ts';
import { order, rankOf, recordSwing } from './ranking.ts';
import { settle } from './settle.ts';
import type { EventResult, JourneyState, JPlayer, SwingReport } from './types.ts';
import { filler, turnOver } from './world.ts';

export interface SwingOutcome {
  state: JourneyState;
  report: SwingReport;
}

export function advanceSwing(s: JourneyState, plan: Plan, withUser = true): SwingOutcome {
  if (s.pending.length) throw new Error('Choices are waiting before the next swing');
  if (s.user.stage === 'retired') throw new Error('The career is over');
  const errors = withUser ? validatePlan(s, plan) : [];
  if (errors.length) throw new Error(`The plan cannot be played: ${errors.join(', ')}`);
  const key = `${s.year}/${s.swing}`;
  const events = [...SWINGS[s.swing]!.events].sort((a, b) => a.week - b.week || (a.id < b.id ? -1 : 1));
  const { fields, proPlace, jrPlace } = aiFields(s);
  const me = s.user.player;
  const playing = withUser && s.user.injury === 0;
  const rank = withUser ? rankOf(me, s.pros, s.points) : null;
  const juniorRank = withUser && s.user.stage === 'junior' ? rankOf(me, s.juniors, s.juniorPoints) : null;
  const rng = stream(s.seed, 'condition', key);
  let cond: Condition = startCondition(me.fatigue);
  const earned = new Map<string, number>();
  const earnedJr = new Map<string, number>();
  const results: EventResult[] = [];
  const skipped: string[] = [];
  const add = (into: Map<string, number>, from: Map<string, number>) => from.forEach((v, k) => into.set(k, (into.get(k) ?? 0) + v));
  const ctx = (user: JPlayer | null): EventContext => ({
    seed: s.seed, key, user, morale: s.user.morale, userFatigue: cond.fatigue, rankOf: (pid) => proPlace.get(pid) ?? jrPlace.get(pid) ?? null,
  });
  for (const ev of events) {
    const junior = JTIERS[ev.tier].junior;
    const place = junior ? jrPlace : proPlace;
    let field = fields.get(ev.id)!;
    let enters = false;
    if (ev.tier === 'finals') {
      const everyone = withUser && s.user.stage === 'pro' ? [...s.pros, me] : s.pros;
      const sofar = recordSwing(s.points, s.swing, earned, everyone.map((p) => p.id));
      const top = order(everyone, sofar).slice(0, JTIERS.finals.draw);
      enters = playing && cond.hurt === 0 && top.includes(me.id);
      const byId = new Map(everyone.map((p) => [p.id, p]));
      field = top.filter((pid) => pid !== me.id).map((pid) => byId.get(pid)!);
    } else if (playing && cond.hurt === 0 && plan.events.includes(ev.id) && eligible(ev, s.user.stage, me.age)) {
      const entry = entryOf(ev, junior ? juniorRank : rank, field, place, s.user.wildcard);
      enters = entry === 'direct' || (entry === 'qualifying' && qualifies(ev, me, stream(s.seed, 'qualifying', key, ev.id)));
      if (!enters) skipped.push(ev.id);
    }
    if (enters) cond = restUntil(cond, ev.week);
    const user = enters ? { ...me, fatigue: cond.fatigue } : null;
    const played = playEvent(ctx(user), ev, draw(s.seed, key, ev, field, user, junior ? juniorRank : rank, place));
    add(junior ? earnedJr : earned, played.earned);
    if (played.result) {
      results.push(played.result);
      cond = afterEvent(cond, ev, played.result.matches.length, me, rng);
    }
  }
  const ids = [...s.pros.map((p) => p.id), ...(withUser ? [me.id] : [])];
  const points = recordSwing(s.points, s.swing, earned, ids);
  const juniorPoints = recordSwing(s.juniorPoints, s.swing, earnedJr, [...s.juniors.map((p) => p.id), ...(withUser && s.user.stage === 'junior' ? [me.id] : [])]);
  const grown = { ...s, pros: s.pros.map((p) => growAi(p, s.seed, s.year)), juniors: s.juniors.map((p) => growAi(p, s.seed, s.year)), points, juniorPoints };
  const end = endSwing(playing ? cond : { ...cond, fatigue: 0 });
  const { state, report } = settle(s, grown, { plan, results, skipped, end, rankBefore: rank, juniorRankBefore: juniorRank, withUser });
  const next = s.swing === 3 ? yearEnd(state) : { ...state, swing: s.swing + 1 };
  return { state: withUser ? queueChoices(next) : next, report };
}

/** AI entrants with the user put in at their place (a qualifier or a late entry takes the last place), then filled. */
function draw(seed: number, key: string, ev: JEvent, field: readonly JPlayer[], user: JPlayer | null, rank: number | null,
  place: ReadonlyMap<string, number>): JPlayer[] {
  const size = JTIERS[ev.tier].draw;
  let list = [...field];
  if (user) {
    const at = rank === null ? list.length : list.filter((p) => (place.get(p.id) ?? 1e9) < rank).length;
    list.splice(Math.min(at, size - 1), 0, user);
  }
  list = list.slice(0, size);
  const spec = JTIERS[ev.tier];
  const rng = stream(seed, 'fill', key, ev.id);
  for (let i = list.length; i < spec.draw; i++) {
    const level = spec.filler[0] + spec.filler[1] * (2 * rng.next() - 1) * 1.7;
    list.push(filler(seed, `${key}/${ev.id}`, i, level, spec.junior ? 15 + Math.floor(rng.next() * 3) : 19 + Math.floor(rng.next() * 12)));
  }
  return list;
}

function yearEnd(s: JourneyState): JourneyState {
  const rank = order(s.pros, s.points);
  const juniorRank = order(s.juniors, s.juniorPoints);
  const { roster } = turnOver({ pros: s.pros, juniors: s.juniors, nextId: s.nextId }, s.seed, s.year, rank, juniorRank, s.user.player.name);
  const keep = (pts: Record<string, number[]>, ps: readonly JPlayer[]) => {
    const ids = new Set([...ps.map((p) => p.id), s.user.player.id]);
    return Object.fromEntries(Object.entries(pts).filter(([pid]) => ids.has(pid)));
  };
  const player = { ...s.user.player, age: s.user.player.age + 1 };
  return {
    ...s, year: s.year + 1, swing: 0, pros: roster.pros, juniors: roster.juniors, nextId: roster.nextId,
    points: keep(s.points, roster.pros), juniorPoints: keep(s.juniorPoints, roster.juniors), user: { ...s.user, player },
  };
}

export { rankFor };
