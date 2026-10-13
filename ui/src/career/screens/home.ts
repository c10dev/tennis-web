// The dashboard: player, this week's choice, the calendar.
import { beginWeek, FOCUS_RATINGS, homeView, type Focus, type Intensity } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

const FOCUS_LABEL: Record<Focus, string> = { serve: 'Serve', groundstrokes: 'Groundstrokes', return: 'Return', physical: 'Physical', mental: 'Mental' };

export function homeScreen(ctx: Ctx): Screen {
  const s = ctx.state!;
  const v = homeView(s);
  const focus = h('select', { id: 'focus' }, (Object.keys(FOCUS_RATINGS) as Focus[]).map((f) => h('option', { value: f }, FOCUS_LABEL[f])));
  const intensity = h('select', { id: 'intensity' }, (['light', 'normal', 'hard'] as Intensity[]).map((i) => h('option', { value: i, selected: i === 'normal' }, i[0]!.toUpperCase() + i.slice(1))));
  const train = async () => {
    const f = focus.value as Focus;
    const i = intensity.value as Intensity;
    const begun = beginWeek(s, { kind: 'train', focus: f, intensity: i });
    await ctx.finishWeek(begun, `Week ${s.week}: trained ${FOCUS_LABEL[f].toLowerCase()} (${i}).`);
  };
  const rest = async () => ctx.finishWeek(beginWeek(s, { kind: 'rest' }), `Week ${s.week}: rested.`);
  const option = (button: HTMLButtonElement, note?: string) => h('div', { class: 'option' }, button, note ? h('span', { class: 'muted note' }, note) : null);
  const week = v.seasonOver
    ? h('div', { class: 'card', id: 'season-over' }, h('h3', null, 'Season complete'),
      h('p', null, `${v.player.name} finished the season ranked #${v.player.rank} with ${v.player.points} points and ${v.player.prize} in prize money.`),
      h('button', { class: 'primary', onclick: () => ctx.go('#/new') }, 'Start a new career'))
    : h('div', { class: 'card', id: 'this-week' },
      h('h3', null, `Week ${v.week}`, v.thisWeek.tournament ? ` · ${v.thisWeek.tournament.name}` : ' · no tournament'),
      v.thisWeek.tournament ? h('p', { class: 'muted' }, `${v.thisWeek.tournament.tier} · ${v.thisWeek.tournament.surface} · draw of ${v.thisWeek.tournament.draw}`) : null,
      v.inTournament
        ? h('button', { class: 'primary', id: 'to-tournament', onclick: () => ctx.go('#/tournament') }, 'Back to the tournament')
        : [
          option(h('button', { class: 'primary', id: 'enter', disabled: !v.options.enter.enabled, onclick: () => { ctx.set(beginWeek(s, { kind: 'enter' })); ctx.go('#/tournament'); } },
            v.thisWeek.tournament ? `Enter ${v.thisWeek.tournament.name}` : 'Enter a tournament'), v.options.enter.note),
          h('div', { class: 'option train' }, focus, intensity,
            h('button', { id: 'train', disabled: !v.options.train.enabled, onclick: () => void train() }, 'Train this week'),
            v.options.train.note ? h('span', { class: 'muted note' }, v.options.train.note) : null),
          option(h('button', { id: 'rest', onclick: () => void rest() }, 'Rest this week')),
        ]);
  const player = h('div', { class: 'card', id: 'player-card' },
    h('h3', null, h('a', { href: '#/player/user' }, v.player.name)),
    h('dl', { class: 'facts' },
      h('dt', null, 'Ranking'), h('dd', { id: 'rank' }, `#${v.player.rank}`),
      h('dt', null, 'Points'), h('dd', null, String(v.player.points)),
      h('dt', null, 'Level'), h('dd', null, v.player.overall.toFixed(1)),
      h('dt', null, 'Condition'), h('dd', { id: 'condition' }, v.player.injuryWeeks ? `Injured (${v.player.injuryWeeks} wk)` : v.player.fatigueLabel),
      h('dt', null, 'Prize money'), h('dd', null, v.player.prize)));
  const calendar = h('table', { class: 'calendar', id: 'calendar' },
    h('thead', null, h('tr', null, h('th', null, 'Wk'), h('th', null, 'Tournament'), h('th', null, 'Tier'), h('th', null, 'Surface'), h('th', null, 'Result'))),
    h('tbody', null, v.calendar.map((row) => {
      const index = s.history.findIndex((x) => x.week === row.week);
      return h('tr', { class: row.status },
        h('td', null, String(row.week)),
        h('td', null, index >= 0 ? h('a', { href: `#/history/${index}` }, row.name) : row.name),
        h('td', null, row.tier), h('td', null, row.surface), h('td', null, row.result ?? (row.status === 'current' ? 'This week' : '')));
    })));
  const element = h('div', { class: 'home' },
    ctx.note ? h('p', { class: 'note-banner', id: 'note' }, ctx.note) : null,
    h('div', { class: 'columns' }, player, week),
    h('h3', null, 'Season calendar'), calendar);
  return { element };
}
