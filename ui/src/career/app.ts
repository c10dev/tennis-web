// The career game: hash-routed screens over one SeasonState, autosaved to IndexedDB at the end of every week.
import { DEFAULT_TACTIC } from '@tennis/engine';
import { closeWeek, fromQuickSave, fromSave, homeView, playerById, playOut, toQuickSave, toSave, USER_ID, type QuickState, type SeasonState } from '@tennis/game';
import { h } from '../lib/h.ts';
import { currentRoute, go } from '../lib/router.ts';
import { IndexedDbStore } from '../storage/indexedDb.ts';
import { tossQuickStore } from '../storage/quick-store.ts';
import { landingFor, routesFor, TARGET } from '../target.ts';
import { getPlatform } from '../platform/index.ts';
import { LANG, U } from '../i18n/index.ts';
import { followSafeArea } from '../lib/safe-area.ts';
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
/** Routes this build offers (ADR-022): the toss build has the quick match only. */
const OFFERED = new Set(routesFor(TARGET));

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

const store = new IndexedDbStore();

const ctx: Ctx = {
  get state() {
    return state;
  },
  store,
  quickStore: TARGET === 'toss' ? tossQuickStore(store) : store,
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
    await ctx.quickStore.saveQuick(toQuickSave(next, stamp()));
    if (path) go(path);
    else void render();
  },
  tactic: { ...DEFAULT_TACTIC },
  go,
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
  if (!state) {
    return h('header', { class: 'top' }, h('a', { href: '#/', class: 'brand' }, 'TennisSim'),
      quick ? h('nav', null, h('a', { href: '#/quick', id: 'nav-quick', class: currentRoute().name === 'quick' ? 'active' : '' }, U.quickMatch)) : null);
  }
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
  if (!OFFERED.has(route.name)) {
    go(landingFor(TARGET));
    return;
  }
  if (!state && NEEDS_STATE.has(route.name)) {
    go('#/');
    return;
  }
  const token = ++renders;
  current?.dispose?.();
  current = null;
  const screen = await (SCREENS[route.name] ?? titleScreen)(ctx, route.params);
  if (token !== renders) {
    screen.dispose?.();
    return;
  }
  current = screen;
  app.replaceChildren(...(screen.bare ? [screen.element] : [header(), h('main', { class: 'career' }, screen.element)]));
  if (route.name === 'home') note = null;
}

window.addEventListener('hashchange', () => void render());
// The game is portrait-only in Toss (ADR-022), and follows Toss's safe area; the web platform ignores both.
document.documentElement.dataset.target = TARGET;
void getPlatform().then((p) => {
  followSafeArea(p, document.documentElement);
  return p.lockPortrait();
});
document.title = 'TennisSim';
document.documentElement.lang = LANG;
// Korean pages need Pretendard at once (the CSS fetches it only when Hangul is laid out); the path is relative to
// the page, like the CSS once built, so the toss bundle finds it too.
if (LANG === 'ko') {
  for (const w of [600, 800]) {
    document.head.append(Object.assign(document.createElement('link'), { rel: 'preload', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous', href: `fonts/pretendard-${w}.subset.woff2` }));
  }
}
void ctx.quickStore.loadQuick().then((file) => {
  if (file) quick = fromQuickSave(file);
}).catch(() => undefined).finally(() => void render());
