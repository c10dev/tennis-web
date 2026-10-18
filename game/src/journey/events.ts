// Choices between swings (ADR-032, kickru's event shape): stage turns, offers and life events, each a title, a text
// and 1–3 options with an effect or a gamble. After a swing the career queues what applies; the user answers one at
// a time before the next swing.
import { stream } from '../rng.ts';
import { EVENTS } from './events-data.ts';
import { applyGain, ovr, type Group } from './ratings.ts';
import { rankOf } from './ranking.ts';
import { CHOICES } from './tuning.ts';
import type { JourneyState, PendingChoice, Stage, UserState } from './types.ts';
import { fill, type Vars } from './vars.ts';

export interface Effect {
  morale?: number;
  reputation?: number;
  money?: number;
  fatigue?: number;
  /** Growth in overall (1–20 scale) put into these groups. */
  gain?: number;
  groups?: Group[];
  coach?: 0 | 1 | 2;
  sponsor?: { fee: number; swings: number } | null;
  stage?: Stage;
  college?: number;
  /** Swings away from the tour (injury, service). */
  away?: number;
  exempt?: boolean;
  wildcard?: boolean;
}

export interface Option {
  id: string;
  label: string;
  detail: string;
  effect?: Effect | ((s: JourneyState, v: Vars) => Effect);
  gamble?: { chance: number | ((s: JourneyState) => number); win: Effect; lose: Effect; winText: string; loseText: string };
  /** The line the next report shows. */
  note?: string;
}

export type { Vars };

export interface LifeEvent {
  id: string;
  kind: 'stage' | 'offer' | 'life';
  title: string;
  text: string;
  /** Happens at most once a career (default), or again after `every` swings. */
  every?: number;
  weight?: number;
  when: (s: JourneyState, c: Context) => boolean;
  vars?: (s: JourneyState, c: Context) => Vars;
  options: Option[] | ((s: JourneyState, v: Vars) => Option[]);
}

export interface Context {
  age: number;
  ovr: number;
  rank: number | null;
  juniorRank: number | null;
  swings: number;
}

const BY_ID = new Map(EVENTS.map((e) => [e.id, e]));

export function context(s: JourneyState): Context {
  const p = s.user.player;
  return {
    age: p.age, ovr: ovr(p), rank: rankOf(p, s.pros, s.points), juniorRank: s.user.stage === 'junior' ? rankOf(p, s.juniors, s.juniorPoints) : null,
    swings: (s.year - 1) * 4 + s.swing,
  };
}

const lastSeen = (s: JourneyState, id: string): number | null => {
  const hit = [...s.seen].reverse().find((k) => k.startsWith(`e:${id}@`));
  return hit ? Number(hit.split('@')[1]) : null;
};

/** Queues the choices that apply now: every stage event, then up to two offers or life events drawn by weight. */
export function queueChoices(s: JourneyState): JourneyState {
  if (s.user.stage === 'retired') return s;
  const c = context(s);
  const rng = stream(s.seed, 'choices', s.year, s.swing);
  const fresh = (e: LifeEvent) => {
    const at = lastSeen(s, e.id);
    return at === null || (e.every !== undefined && c.swings - at >= e.every);
  };
  const open = EVENTS.filter((e) => fresh(e) && e.when(s, c));
  const stage = open.filter((e) => e.kind === 'stage');
  const pool = open.filter((e) => e.kind !== 'stage');
  const picked: LifeEvent[] = [];
  const roll = rng.next();
  const count = stage.length ? 0 : roll < CHOICES.none ? 0 : roll < CHOICES.none + CHOICES.one ? 1 : 2;
  for (let i = 0; i < count && pool.length; i++) {
    let r = rng.next() * pool.reduce((a, e) => a + (e.weight ?? 1), 0);
    const at = pool.findIndex((e) => (r -= e.weight ?? 1) < 0);
    picked.push(...pool.splice(at < 0 ? pool.length - 1 : at, 1));
  }
  const pending: PendingChoice[] = [...stage.slice(0, 1), ...picked].map((e) => ({ event: e.id, vars: e.vars?.(s, c) ?? {} }));
  return { ...s, pending: [...s.pending, ...pending], seen: [...s.seen, ...pending.map((p) => `e:${p.event}@${c.swings}`)] };
}

export interface ChoiceView {
  id: string;
  kind: LifeEvent['kind'];
  title: string;
  text: string;
  options: { id: string; label: string; detail: string }[];
}

export function currentChoice(s: JourneyState): ChoiceView | null {
  const p = s.pending[0];
  if (!p) return null;
  const e = BY_ID.get(p.event)!;
  return {
    id: e.id, kind: e.kind, title: fill(e.title, p.vars), text: fill(e.text, p.vars),
    options: optionsOf(e, s, p.vars).map((o) => ({ id: o.id, label: fill(o.label, p.vars), detail: fill(o.detail, p.vars) })),
  };
}

/** Answers the first pending choice; a gamble is drawn from the career's seed. */
export function choose(s: JourneyState, optionId: string): { state: JourneyState; note: string } {
  const p = s.pending[0];
  if (!p) throw new Error('No choice is waiting');
  const e = BY_ID.get(p.event)!;
  const o = optionsOf(e, s, p.vars).find((x) => x.id === optionId);
  if (!o) throw new Error(`No option ${optionId} for ${e.id}`);
  let effect: Effect = typeof o.effect === 'function' ? o.effect(s, p.vars) : o.effect ?? {};
  let note = o.note ? fill(o.note, p.vars) : '';
  if (o.gamble) {
    const chance = typeof o.gamble.chance === 'function' ? o.gamble.chance(s) : o.gamble.chance;
    const won = stream(s.seed, 'gamble', p.event, s.year, s.swing).next() < chance;
    effect = { ...effect, ...(won ? o.gamble.win : o.gamble.lose) };
    note = fill(won ? o.gamble.winText : o.gamble.loseText, p.vars);
  }
  const state = { ...s, user: apply(s.user, effect), pending: s.pending.slice(1), notes: note ? [...s.notes, note] : s.notes };
  return { state, note };
}

function apply(u: UserState, e: Effect): UserState {
  const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
  const player = e.gain ? applyGain(u.player, e.gain * CHOICES.gainScale, e.groups ?? []) : u.player;
  return {
    ...u,
    player: e.fatigue ? { ...player, fatigue: Math.min(1, Math.max(0, player.fatigue + e.fatigue)) } : player,
    morale: clamp(u.morale + (e.morale ?? 0)),
    reputation: clamp(u.reputation + (e.reputation ?? 0)),
    money: u.money + (e.money ?? 0),
    ...(e.coach !== undefined ? { coach: e.coach } : {}),
    ...(e.sponsor !== undefined ? { sponsor: e.sponsor } : {}),
    ...(e.stage ? { stage: e.stage } : {}),
    ...(e.college !== undefined ? { college: e.college } : {}),
    ...(e.away ? { injury: u.injury + e.away, away: 'service' as const } : {}),
    ...(e.exempt ? { exempt: true } : {}),
    ...(e.wildcard ? { wildcard: true } : {}),
  };
}

const optionsOf = (e: LifeEvent, s: JourneyState, v: Vars): Option[] => (typeof e.options === 'function' ? e.options(s, v) : e.options);

