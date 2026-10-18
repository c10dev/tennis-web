// "구간 보내기" (ADR-032): plays one swing for the whole world — every event's draw, the user's chosen ones with the
// engine — then growth, condition and the books (settle.ts), and the year's turnover after the last swing.
import { stream } from '../rng.ts';
import { JTIERS, SWINGS, type JEvent } from './calendar.ts';
import { accepted, aiEntrants, schedule } from './entry.ts';
import { queueChoices } from './events.ts';
import { growAi } from './growth.ts';
import { playEvent, type EventContext } from './play.ts';
import { order, rankOf, recordSwing } from './ranking.ts';
import { settle } from './settle.ts';
import type { EventResult, JourneyState, JPlayer, Plan, SwingReport } from './types.ts';
import { filler, turnOver } from './world.ts';

export interface SwingOutcome {
  state: JourneyState;
  report: SwingReport;
}

export function advanceSwing(s: JourneyState, plan: Plan, withUser = true): SwingOutcome {
  if (s.pending.length) throw new Error('Choices are waiting before the next swing');
  if (s.user.stage === 'retired') throw new Error('The career is over');
  const key = `${s.year}/${s.swing}`;
  const events = SWINGS[s.swing]!.events;
  const user = withUser ? s.user.player : null;
  const proPlace = places(order(s.pros, s.points));
  const jrPlace = places(order(s.juniors, s.juniorPoints));
  const rank = withUser ? rankOf(s.user.player, s.pros, s.points) : null;
  const juniorRank = withUser && s.user.stage === 'junior' ? rankOf(s.user.player, s.juniors, s.juniorPoints) : null;
  const fields = new Map(events.map((ev) => {
    const junior = JTIERS[ev.tier].junior;
    return [ev.id, aiEntrants(s.seed, key, ev, junior ? s.juniors : s.pros, junior ? jrPlace : proPlace)] as const;
  }));
  const wildcard = (ev: JEvent) => ev.tier === 'major' && s.user.wildcard === true && s.user.stage === 'pro';
  const open = events.filter((ev) => ev.tier !== 'finals' && (wildcard(ev) || accepted(ev, JTIERS[ev.tier].junior ? juniorRank : rank, fields.get(ev.id)!, JTIERS[ev.tier].junior ? jrPlace : proPlace)));
  const chosen = new Set(user && s.user.injury === 0 ? schedule({ stage: s.user.stage, age: user.age, load: plan.load, open }).map((e) => e.id) : []);
  const ctx: EventContext = {
    seed: s.seed, key, user, morale: s.user.morale, userFatigue: s.user.player.fatigue,
    rankOf: (pid) => proPlace.get(pid) ?? jrPlace.get(pid) ?? null,
  };
  const earned = new Map<string, number>();
  const earnedJr = new Map<string, number>();
  const results: EventResult[] = [];
  const add = (into: Map<string, number>, from: Map<string, number>) => from.forEach((v, k) => into.set(k, (into.get(k) ?? 0) + v));
  for (const ev of events.filter((e) => e.tier !== 'finals')) {
    const junior = JTIERS[ev.tier].junior;
    const entrants = draw(s.seed, key, ev, fields.get(ev.id)!, chosen.has(ev.id) ? user : null, junior ? juniorRank : rank, junior ? jrPlace : proPlace);
    const played = playEvent(ctx, ev, entrants);
    add(junior ? earnedJr : earned, played.earned);
    if (played.result) results.push(played.result);
  }
  const finals = events.find((e) => e.tier === 'finals');
  if (finals) {
    const everyone = user && s.user.stage === 'pro' ? [...s.pros, user] : s.pros;
    const sofar = recordSwing(s.points, s.swing, earned, everyone.map((p) => p.id));
    const top = order(everyone, sofar).slice(0, JTIERS.finals.draw);
    const byId = new Map(everyone.map((p) => [p.id, p]));
    const userIn = user !== null && top.includes(user.id) && s.user.injury === 0;
    const entrants = top.filter((pid) => userIn || pid !== user?.id).map((pid) => byId.get(pid)!);
    const played = playEvent({ ...ctx, user: userIn ? user : null }, finals, fill(s.seed, key, finals, entrants));
    add(earned, played.earned);
    if (played.result) results.push(played.result);
  }
  const ids = [...s.pros.map((p) => p.id), ...(user ? [user.id] : [])];
  const points = recordSwing(s.points, s.swing, earned, ids);
  const juniorPoints = recordSwing(s.juniorPoints, s.swing, earnedJr, [...s.juniors.map((p) => p.id), ...(user && s.user.stage === 'junior' ? [user.id] : [])]);
  const grown = { ...s, pros: s.pros.map((p) => growAi(p, s.seed, s.year)), juniors: s.juniors.map((p) => growAi(p, s.seed, s.year)), points, juniorPoints };
  const { state, report } = settle(s, grown, { plan, results, rankBefore: rank, juniorRankBefore: juniorRank, injuryRng: stream(s.seed, 'injury', key), withUser });
  const next = s.swing === 3 ? yearEnd(state) : { ...state, swing: s.swing + 1 };
  return { state: withUser ? queueChoices(next) : next, report };
}

/** AI entrants with the user put in at their place (or in the last slot of an open event), then filled. */
function draw(seed: number, key: string, ev: JEvent, field: readonly JPlayer[], user: JPlayer | null, rank: number | null,
  place: ReadonlyMap<string, number>): JPlayer[] {
  const size = JTIERS[ev.tier].draw;
  let list = [...field];
  if (user) {
    const at = rank === null ? list.length : list.filter((p) => (place.get(p.id) ?? 1e9) < rank).length;
    list.splice(Math.min(at, size - 1), 0, user);
  }
  list = list.slice(0, size);
  return fill(seed, key, ev, list);
}

function fill(seed: number, key: string, ev: JEvent, list: readonly JPlayer[]): JPlayer[] {
  const spec = JTIERS[ev.tier];
  const rng = stream(seed, 'fill', key, ev.id);
  const out = [...list];
  for (let i = out.length; i < spec.draw; i++) {
    const level = spec.filler[0] + spec.filler[1] * (2 * rng.next() - 1) * 1.7;
    out.push(filler(seed, `${key}/${ev.id}`, i, level, spec.junior ? 15 + Math.floor(rng.next() * 3) : 19 + Math.floor(rng.next() * 12)));
  }
  return out;
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

const places = (ids: readonly string[]) => new Map(ids.map((pid, i) => [pid, i + 1]));
