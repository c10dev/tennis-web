// The text tour (ADR-033): hash routes over plain DOM, no Three.js. `#/play` sends the player wherever the room needs
// them: the lobby, a report they have not read, the plan, or the wait for friends.
import './journey.css';
import { h } from '../lib/h.ts';
import { currentRoute, go } from '../lib/router.ts';
import { activeRoom, clientFor, reportSeen, roomServer } from './session.ts';
import { createScreen } from './screens/create.ts';
import { lobbyScreen } from './screens/lobby.ts';
import { matchScreen } from './screens/match.ts';
import { planScreen } from './screens/plan.ts';
import { reportScreen } from './screens/report.ts';
import { startScreen } from './screens/start.ts';
import { waitScreen } from './screens/wait.ts';

export interface Screen {
  element: HTMLElement;
  /** Called when the screen is replaced (timers, subscriptions). */
  dispose?: () => void;
}

export type ScreenFn = (params: string[], rerender: () => void) => Screen | Promise<Screen>;

const SCREENS: Record<string, ScreenFn> = {
  '': startScreen, new: createScreen, lobby: lobbyScreen, plan: planScreen, wait: waitScreen, report: reportScreen, match: matchScreen,
  play: async () => ({ element: h('p', { class: 'j-loading' }, '불러오는 중…') }),
};

/** Where the active room wants this player now. */
export async function nextStop(): Promise<string> {
  const code = activeRoom();
  if (!code) return '#/';
  const client = clientFor(code);
  const mine = await client.mine().catch(() => null);
  if (!mine) return '#/lobby';
  const { synced, state } = mine;
  if (synced.info.swing > reportSeen(code) && state.reports.length) return `#/report/${synced.info.swing - 1}`;
  const subs = await roomServer().submissions(code, synced.info.swing);
  return subs[synced.me]?.ready ? '#/wait' : '#/plan';
}

const root = document.querySelector<HTMLElement>('#app')!;
document.documentElement.dataset.journey = '';
let current: Screen | null = null;
let token = 0;

async function render(): Promise<void> {
  const mine = ++token;
  const route = currentRoute();
  if (route.name === 'play') {
    const stop = await nextStop();
    // A newer render (a hash change or a room update) may have started meanwhile; only the latest one moves on.
    if (mine === token) go(stop);
    return;
  }
  const fn = SCREENS[route.name] ?? startScreen;
  let screen: Screen;
  try {
    screen = await fn(route.params, () => void render());
  } catch (e) {
    screen = { element: h('div', { class: 'j-card j-error' }, h('p', null, e instanceof Error ? e.message : String(e)), h('button', { onclick: () => go('#/') }, '처음으로')) };
  }
  if (mine !== token) {
    screen.dispose?.();
    return;
  }
  current?.dispose?.();
  current = screen;
  root.replaceChildren(h('header', { class: 'j-top' }, h('a', { href: '#/', class: 'j-brand' }, '랠리 투어'), activeRoom() ? h('a', { href: '#/play' }, '내 방') : null),
    h('main', { class: 'j-main' }, screen.element));
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => void render());
void render();
