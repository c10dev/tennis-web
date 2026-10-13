// This week's tournament: the draw round by round, the user's next match with tactics, and the round buttons.
import type { Tactic } from '@tennis/engine';
import { pendingUserMatch, playOut, playRound, quickRecipe, resultLabel, roundsWon, tournamentView, USER_ID } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

export function tacticControls(ctx: Ctx): HTMLElement {
  const set = (patch: Partial<Tactic>) => {
    ctx.tactic = { ...ctx.tactic, ...patch };
  };
  const aggression = h('input', { id: 'aggression', type: 'range', min: 0, max: 1, step: 0.05, value: String(ctx.tactic.aggression),
    oninput: (e: Event) => set({ aggression: Number((e.target as HTMLInputElement).value) }) });
  return h('div', { class: 'tactics' },
    h('label', null, 'Aggression', h('span', { class: 'muted' }, ' safe'), aggression, h('span', { class: 'muted' }, 'all-out')),
    h('label', null, h('input', { id: 'target-backhand', type: 'checkbox', checked: ctx.tactic.targetBackhand,
      onchange: (e: Event) => set({ targetBackhand: (e.target as HTMLInputElement).checked }) }), ' Aim at the backhand'),
    h('label', null, 'Serve ', h('select', { id: 'serve-target', onchange: (e: Event) => set({ serveTarget: (e.target as HTMLSelectElement).value as Tactic['serveTarget'] }) },
      (['mix', 'wide', 'body', 't'] as const).map((t) => h('option', { value: t, selected: t === ctx.tactic.serveTarget }, t === 't' ? 'T' : t[0]!.toUpperCase() + t.slice(1))))));
}

export function tournamentScreen(ctx: Ctx): Screen {
  const s = ctx.state!;
  const v = tournamentView(s);
  if (!v) {
    ctx.redirect('#/home');
    return { element: h('div') };
  }
  const quick = () => {
    const pending = pendingUserMatch(s)!;
    ctx.set(playRound(s, quickRecipe(pending, ctx.tactic)));
  };
  const actions = v.pending
    ? h('div', { class: 'card', id: 'your-match' },
      h('h3', null, `Your ${v.pending.round.toLowerCase()}: vs ${v.pending.opponent}`),
      h('p', { class: 'muted' }, `#${v.pending.opponentRank} · level ${v.pending.opponentLevel.toFixed(1)} · ${v.pending.opponentStyle} · best of ${v.pending.bestOf}`),
      tacticControls(ctx),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', id: 'watch', onclick: () => ctx.go('#/match') }, 'Watch the match'),
        h('button', { id: 'quick', onclick: quick }, 'Quick result')))
    : v.done
      ? h('div', { class: 'card', id: 'tournament-done' }, h('h3', null, `Champion: ${v.champion}`),
        h('button', { class: 'primary', id: 'finish-week', onclick: () => void ctx.finishWeek(s, weekNote()) }, 'Finish the week'))
      : h('div', { class: 'card' }, h('p', null, v.userIn && !v.userAlive ? 'You are out of the tournament.' : 'The tournament goes on.'),
        h('div', { class: 'actions' },
          h('button', { class: 'primary', id: 'play-round', onclick: () => ctx.set(playRound(s)) }, 'Play the next round'),
          h('button', { id: 'play-all', onclick: () => ctx.set(playOut(s)) }, 'Play to the end')));
  function weekNote(): string {
    const you = v!.userIn ? ` You: ${resultLabel(v!.size, roundsWon(s.tournament!.bracket, USER_ID)).toLowerCase()}.` : '';
    return `Week ${s.week}: ${v!.name} won by ${v!.champion}.${you}`;
  }
  const element = h('div', { class: 'tournament' },
    // A note for this screen (a save loaded mid-tournament lands here, not on Home).
    ctx.note ? h('p', { class: 'note-banner', id: 'note' }, ctx.note) : null,
    h('h2', null, v.name, h('span', { class: 'muted' }, ` · ${v.tier} · ${v.surface}`)),
    actions,
    // Each round is a list named by its heading, each match an item named with its winner (bold alone says nothing
    // to a screen reader).
    h('div', { class: 'draw', id: 'draw' }, v.rounds.map((r, k) => h('div', { class: 'round' }, h('h4', { id: `round-${k}` }, r.name),
      h('div', { role: 'list', 'aria-labelledby': `round-${k}` }, r.matches.map((m) => h('div', { class: `match${m.isUser ? ' user' : ''}`, role: 'listitem', 'aria-label': matchLabel(m) },
        h('span', { class: m.winner === 'a' ? 'won' : '' }, m.a), h('span', { class: 'vs' }, ' v '), h('span', { class: m.winner === 'b' ? 'won' : '' }, m.b),
        m.score ? h('span', { class: 'score' }, m.score) : null)))))));
  return { element };
}

/** "Alex Kim beat Garek Ashic 6-3 6-4", or "A v B" before it is played. */
function matchLabel(m: { a: string; b: string; winner: 'a' | 'b' | null; score: string }): string {
  if (!m.winner) return `${m.a} v ${m.b}`;
  const [w, l] = m.winner === 'a' ? [m.a, m.b] : [m.b, m.a];
  return `${w} beat ${l}${m.score ? ` ${m.score}` : ''}`;
}
