// The room before its season: the invite code, who has joined, and the host's start button.
import { h } from '../../lib/h.ts';
import { go } from '../../lib/router.ts';
import type { Screen } from '../app.ts';
import { STYLE } from '../format.ts';
import { activeRoom, me, roomServer } from '../session.ts';

export async function lobbyScreen(_params: string[], rerender: () => void): Promise<Screen> {
  const code = activeRoom();
  if (!code) {
    go('#/');
    return { element: h('div') };
  }
  const server = roomServer();
  const info = await server.room(code);
  if (info.phase === 'season') {
    go('#/play');
    return { element: h('div') };
  }
  const host = info.host === me();
  const error = h('p', { class: 'j-error-text', role: 'alert' });
  const start = async () => {
    try {
      await server.start(code);
      go('#/play');
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : String(e);
    }
  };
  const share = () => void navigator.clipboard?.writeText(code).catch(() => undefined);
  const element = h('section', { class: 'j-lobby' },
    h('h1', null, '시즌 방'),
    h('div', { class: 'j-card j-code' }, h('p', null, '초대 코드'), h('strong', { id: 'room-code' }, code), h('button', { onclick: share }, '코드 복사')),
    h('div', { class: 'j-card' }, h('h2', null, `참가자 ${info.members.length}/8`),
      h('ul', { class: 'j-list', id: 'members' }, ...info.members.map((m) => h('li', null, h('b', null, m.name), ` · ${STYLE[m.style]}`, m.id === info.host ? ' · 방장' : '')))),
    host ? h('button', { class: 'primary big', id: 'start-season', onclick: () => void start() }, '시즌 시작') : h('p', { class: 'j-muted', id: 'waiting-host' }, '방장이 시즌을 시작하길 기다리는 중…'),
    error);
  const off = server.subscribe(code, rerender);
  return { element, dispose: off };
}
