// The career game: hash-routed screens over one SeasonState, autosaved to IndexedDB at the end of every week.
import { DEFAULT_TACTIC } from '@tennis/engine';
import { closeWeek, fromSave, homeView, playerById, playOut, toSave, USER_ID, type SeasonState } from '@tennis/game';
import { h } from '../lib/h.ts';
import { currentRoute, go } from '../lib/router.ts';
import { IndexedDbStore } from '../storage/indexedDb.ts';
import type { Ctx, Screen } from './context.ts';
import { historyScreen } from './screens/history.ts';
import { homeScreen } from './screens/home.ts';
import { newCareerScreen } from './screens/newCareer.ts';
import { playerScreen } from './screens/player.ts';
import { rankingsScreen } from './screens/rankings.ts';
import { savesScreen } from './screens/saves.ts';
import { titleScreen } from './screens/title.ts';
import { tournamentScreen } from './screens/tournament.ts';
import './career.css';

type ScreenFn = (ctx: Ctx, params: string[]) => Screen | Promise<Screen>;
const SCREENS: Record<string, ScreenFn> = {
  '': titleScreen, new: newCareerScreen, saves: savesScreen,
  home: homeScreen, tournament: tournamentScreen, history: historyScreen, rankings: rankingsScreen, player: playerScreen,
};
const NEEDS_STATE = new Set(['home', 'tournament', 'history', 'rankings', 'player', 'match']);

const app = document.getElementById('app')!;
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
let state: SeasonState | null = null;
let note: string | null = null;
let current: Screen | null = null;

const ctx: Ctx = {
  get state() {
    return state;
  },
  store: new IndexedDbStore(),
  get note() {
    return note;
  },
  tactic: { ...DEFAULT_TACTIC },
  go,
  set(next, message) {
    state = next;
    if (message !== undefined) note = message;
    void render();
  },
  async finishWeek(s, message) {
    // The week's tournament goes on without the user if they are not in it (or are out).
    state = closeWeek(playOut(s));
    const hurt = playerById(state, USER_ID).injuryWeeks;
    note = hurt > 0 && playerById(s, USER_ID).injuryWeeks === 0 ? `${message} Injured: out for ${hurt} week${hurt === 1 ? '' : 's'}.` : message;
    await ctx.store.save('auto', toSave(state, stamp()));
    go('#/home');
  },
  async loadSlot(slot) {
    const file = await ctx.store.load(slot);
    if (!file) throw new Error('That slot is empty');
    state = fromSave(file);
    note = `Loaded ${file.summary.name}, week ${file.summary.week}.`;
    go(state.tournament ? '#/tournament' : '#/home');
  },
  async saveSlot(slot) {
    if (!state) throw new Error('There is no career to save');
    await ctx.store.save(slot, toSave(state, stamp()));
  },
};

function header(): HTMLElement {
  if (!state) return h('header', { class: 'top' }, h('a', { href: '#/', class: 'brand' }, 'TennisSim'));
  const v = homeView(state);
  const link = (path: string, label: string, id: string) =>
    h('a', { href: path, id, class: currentRoute().name === path.slice(2) ? 'active' : '' }, label);
  return h('header', { class: 'top' },
    h('a', { href: '#/', class: 'brand' }, 'TennisSim'),
    h('nav', null, link('#/home', 'Home', 'nav-home'), state.tournament ? link('#/tournament', 'Tournament', 'nav-tournament') : null,
      link('#/rankings', 'Rankings', 'nav-rankings'), link('#/player/user', 'My player', 'nav-player'), link('#/saves', 'Saves', 'nav-saves')),
    h('div', { class: 'status', id: 'status' }, v.seasonOver ? 'Season over' : `Week ${v.week} of ${v.weeks}`, ' · ', `#${v.player.rank}`));
}

async function render(): Promise<void> {
  const route = currentRoute();
  if (!state && NEEDS_STATE.has(route.name)) {
    go('#/');
    return;
  }
  current?.dispose?.();
  const screen = await (SCREENS[route.name] ?? titleScreen)(ctx, route.params);
  current = screen;
  app.replaceChildren(...(screen.bare ? [screen.element] : [header(), h('main', { class: 'career' }, screen.element)]));
  if (route.name === 'home') note = null;
}

window.addEventListener('hashchange', () => void render());
document.title = 'TennisSim';
void render();
