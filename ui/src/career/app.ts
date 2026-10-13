// The career game: hash-routed screens over one SeasonState, autosaved to IndexedDB at the end of every week.
import { DEFAULT_TACTIC } from '@tennis/engine';
import { closeWeek, fromQuickSave, fromSave, homeView, playerById, playOut, toQuickSave, toSave, USER_ID, type QuickState, type SeasonState } from '@tennis/game';
import { h } from '../lib/h.ts';
import { currentRoute, go, replace } from '../lib/router.ts';
import { IndexedDbStore } from '../storage/indexedDb.ts';
import type { Ctx, Screen } from './context.ts';
import { historyScreen } from './screens/history.ts';
import { homeScreen } from './screens/home.ts';
import { matchScreen } from './screens/match.ts';
import { newCareerScreen } from './screens/newCareer.ts';
import { playerScreen } from './screens/player.ts';
import { rankingsScreen } from './screens/rankings.ts';
import { savesScreen } from './screens/saves.ts';
import { titleScreen } from './screens/title.ts';
import { quickScreen } from '../quick/screens.ts';
import { tournamentScreen } from './screens/tournament.ts';
import './career.css';

type ScreenFn = (ctx: Ctx, params: string[]) => Screen | Promise<Screen>;
const SCREENS: Record<string, ScreenFn> = {
  '': titleScreen, new: newCareerScreen, saves: savesScreen, quick: quickScreen,
  home: homeScreen, tournament: tournamentScreen, history: historyScreen, rankings: rankingsScreen, player: playerScreen, match: matchScreen,
};
const NEEDS_STATE = new Set(['home', 'tournament', 'history', 'rankings', 'player', 'match']);

const app = document.getElementById('app')!;
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
let state: SeasonState | null = null;
let quick: QuickState | null = null;
const FAST = 'tennis-fast-mode';
const readFast = () => {
  try {
    return localStorage.getItem(FAST) === '1';
  } catch {
    return false;
  }
};
let note: string | null = null;
let current: Screen | null = null;
/** Renders are async (screens may load code); only the latest one may show. */
let renders = 0;

const ctx: Ctx = {
  get state() {
    return state;
  },
  store: new IndexedDbStore(),
  get note() {
    return note;
  },
  get quick() {
    return quick;
  },
  quickMatch: null,
  get fastMode() {
    return readFast();
  },
  set fastMode(on: boolean) {
    try {
      localStorage.setItem(FAST, on ? '1' : '0');
    } catch {
      // Private windows may refuse storage; the toggle then lasts for this page only.
    }
  },
  async setQuick(next, path) {
    quick = next;
    // A failed save (blocked or full storage) must not stop the game: the ladder goes on in memory.
    try {
      await ctx.store.saveQuick(toQuickSave(next, stamp()));
    } catch (e) {
      console.warn(`Quick ladder not saved: ${(e as Error).message}`);
    }
    if (path) go(path);
    else void render();
  },
  tactic: { ...DEFAULT_TACTIC },
  go,
  redirect: replace,
  set(next, message, path) {
    state = next;
    if (message !== undefined) note = message;
    if (path) go(path);
    else void render();
  },
  async finishWeek(s, message) {
    // The week's tournament goes on without the user if they are not in it (or are out).
    state = closeWeek(playOut(s));
    const hurt = playerById(state, USER_ID).injuryWeeks;
    note = hurt > 0 && playerById(s, USER_ID).injuryWeeks === 0 ? `${message} Injured: out for ${hurt} week${hurt === 1 ? '' : 's'}.` : message;
    // The week is closed: the old page must not act while the autosave is written. A failed save (blocked or full
    // storage) must not freeze the page: the season goes on in memory and the note says the save failed.
    app.inert = true;
    try {
      await ctx.store.save('auto', toSave(state, stamp()));
    } catch (e) {
      note = `${note} Autosave failed: ${(e as Error).message}.`;
    } finally {
      go('#/home');
    }
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
  if (!state) {
    return h('header', { class: 'top' }, h('a', { href: '#/', class: 'brand' }, 'TennisSim'),
      quick ? h('nav', null, h('a', { href: '#/quick', id: 'nav-quick', class: currentRoute().name === 'quick' ? 'active' : '' }, 'Quick match')) : null);
  }
  const v = homeView(state);
  const link = (path: string, label: string, id: string) =>
    h('a', { href: path, id, class: location.hash === path || currentRoute().name === path.slice(2) ? 'active' : '' }, label);
  return h('header', { class: 'top' },
    h('a', { href: '#/', class: 'brand' }, 'TennisSim'),
    h('nav', null, link('#/home', 'Home', 'nav-home'), state.tournament ? link('#/tournament', 'Tournament', 'nav-tournament') : null,
      link('#/rankings', 'Rankings', 'nav-rankings'), link('#/player/user', 'My player', 'nav-player'), link('#/saves', 'Saves', 'nav-saves')),
    h('div', { class: 'status', id: 'status' }, v.seasonOver ? 'Season over' : `Week ${v.week} of ${v.weeks}`, ' · ', `#${v.player.rank}`));
}

let shownPath: string | null = null;

async function render(): Promise<void> {
  const route = currentRoute();
  const path = location.hash;
  if (!state && NEEDS_STATE.has(route.name)) {
    replace('#/');
    return;
  }
  const token = ++renders;
  current?.dispose?.();
  current = null;
  // The old page stays up while the next one loads; it must not act on a season that has moved on (a second click
  // would play a round again).
  app.inert = true;
  let screen: Screen;
  try {
    screen = await (SCREENS[route.name] ?? titleScreen)(ctx, route.params);
  } catch (e) {
    screen = { element: h('section', { class: 'card' }, h('p', { class: 'error', id: 'screen-error' }, `This screen could not open: ${(e as Error).message}`)) };
  }
  if (token !== renders) {
    screen.dispose?.();
    return;
  }
  current = screen;
  app.replaceChildren(...(screen.bare ? [screen.element] : [header(), h('main', { class: 'career' }, screen.element)]));
  app.inert = false;
  // A new screen opens at its top; a re-render of the same screen (after an action) keeps the place.
  if (path !== shownPath) window.scrollTo(0, 0);
  shownPath = path;
  // The screens that show the note have now shown it.
  if (route.name === 'home' || route.name === 'tournament') note = null;
}

window.addEventListener('hashchange', () => void render());
document.title = 'TennisSim';
void ctx.store.loadQuick().then((file) => {
  if (file) quick = fromQuickSave(file);
}).catch(() => undefined).finally(() => void render());
