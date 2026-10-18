// The first screen: practice alone, open a room, or join one with a code.
import { h } from '../../lib/h.ts';
import { go } from '../../lib/router.ts';
import type { Screen } from '../app.ts';
import { activeRoom } from '../session.ts';

export function startScreen(): Screen {
  const code = h('input', { id: 'join-code', placeholder: '초대 코드 6자리', maxLength: 6, autocapitalize: 'characters', 'aria-label': '초대 코드' });
  const error = h('p', { class: 'j-error-text', role: 'alert' });
  const join = () => {
    const v = code.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(v)) {
      error.textContent = '초대 코드는 6자리예요';
      return;
    }
    go(`#/new/join/${v}`);
  };
  const element = h('section', { class: 'j-start' },
    h('h1', null, '랠리 투어'),
    h('p', { class: 'j-lead' }, '친구들과 같은 투어에서 한 시즌. 대회 일정을 직접 짜고, 팀을 꾸리고, 랭킹으로 겨뤄요.'),
    activeRoom() ? h('button', { class: 'primary big', id: 'continue', onclick: () => go('#/play') }, '이어하기') : null,
    h('div', { class: 'j-card' },
      h('h2', null, '친구와 시즌'),
      h('button', { class: 'primary', id: 'make-room', onclick: () => go('#/new/room') }, '방 만들기'),
      h('div', { class: 'j-row' }, code, h('button', { id: 'join', onclick: join }, '참가')),
      error),
    h('div', { class: 'j-card' },
      h('h2', null, '혼자 연습'),
      h('p', { class: 'j-muted' }, 'AI 선수들만 있는 투어에서 한 시즌을 먼저 해 봐요.'),
      h('button', { id: 'practice', onclick: () => go('#/new/practice') }, '연습 시즌 시작')));
  return { element };
}
