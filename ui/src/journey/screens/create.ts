// Making a player (ADR-033): name, nation, style, hand, ten talent points and a training focus. Everyone in a room
// starts at the same OVR; talents only change the shape, which the bars show as points move.
import { createPro, GROUP_KO, GROUPS, groupValues, NATIONS, ovr, type Group, type JourneyStyle, type Member, type Nation, type Talents } from '@tennis/game';
import { h } from '../../lib/h.ts';
import { go } from '../../lib/router.ts';
import type { Screen } from '../app.ts';
import { STYLE } from '../format.ts';
import { randomSeed, roomServer, setActiveRoom } from '../session.ts';

const TALENTS = 10;
const STYLES: JourneyStyle[] = ['big_server', 'baseliner', 'counter_puncher', 'all_court'];

export function createScreen(params: string[]): Screen {
  const mode = (params[0] ?? 'practice') as 'practice' | 'room' | 'join';
  const code = params[1] ?? '';
  const talents: Talents = {};
  let style: JourneyStyle = 'all_court';
  let focus: Group[] = [];
  const name = h('input', { id: 'name', maxLength: 8, placeholder: '선수 이름', 'aria-label': '선수 이름' });
  const nation = h('select', { id: 'nation', 'aria-label': '국적' }, ...Object.entries(NATIONS).map(([k, n]) => h('option', { value: k, selected: k === 'KOR' }, n.name)));
  const hand = h('select', { id: 'hand', 'aria-label': '주 손' }, h('option', { value: 'right' }, '오른손'), h('option', { value: 'left' }, '왼손'));
  const left = h('b', { id: 'talents-left' });
  const bars = h('div', { class: 'j-bars' });
  const ovrText = h('span');
  const styleRow = h('div', { class: 'j-chips', role: 'group', 'aria-label': '플레이 스타일' });
  const talentRows = h('div', { class: 'j-talents' });
  const focusRow = h('div', { class: 'j-chips', role: 'group', 'aria-label': '집중 훈련' });
  const error = h('p', { class: 'j-error-text', role: 'alert' });

  const used = () => GROUPS.reduce((a, g) => a + (talents[g] ?? 0), 0);
  const draw = () => {
    left.textContent = String(TALENTS - used());
    const p = createPro({ name: name.value || '선수', nation: nation.value as Nation, style }, talents);
    const g = groupValues(p);
    ovrText.textContent = `OVR ${ovr(p)}`;
    bars.replaceChildren(...GROUPS.map((k) => h('div', { class: 'j-bar' }, h('span', null, GROUP_KO[k]), h('i', { style: `--v:${g[k]}` }), h('b', null, g[k]))));
    styleRow.replaceChildren(...STYLES.map((s) => h('button', { class: s === style ? 'chip on' : 'chip', 'aria-pressed': String(s === style), onclick: () => { style = s; draw(); } }, STYLE[s]!)));
    talentRows.replaceChildren(...GROUPS.map((k) => h('div', { class: 'j-talent' }, h('span', null, GROUP_KO[k]),
      h('button', { 'aria-label': `${GROUP_KO[k]} 빼기`, disabled: !(talents[k] ?? 0), onclick: () => { talents[k] = (talents[k] ?? 0) - 1; draw(); } }, '−'),
      h('b', { dataset: { group: k } }, talents[k] ?? 0),
      h('button', { 'aria-label': `${GROUP_KO[k]} 더하기`, disabled: used() >= TALENTS, onclick: () => { talents[k] = (talents[k] ?? 0) + 1; draw(); } }, '+'))));
    focusRow.replaceChildren(...GROUPS.map((k) => h('button', { class: focus.includes(k) ? 'chip on' : 'chip', 'aria-pressed': String(focus.includes(k)),
      onclick: () => { focus = focus.includes(k) ? focus.filter((x) => x !== k) : [...focus, k].slice(-2); draw(); } }, GROUP_KO[k])));
  };
  name.addEventListener('input', draw);

  const submit = async () => {
    const n = name.value.trim();
    if (!n) {
      error.textContent = '이름을 입력해 주세요';
      return;
    }
    const member: Omit<Member, 'id'> = { name: n, nation: nation.value as Nation, style, hand: hand.value as 'right' | 'left', talents: { ...talents }, focus };
    const server = roomServer();
    try {
      if (mode === 'join') {
        await server.joinRoom(code, member);
        setActiveRoom(code);
        go('#/lobby');
      } else {
        const info = await server.createRoom(member, randomSeed() || 1);
        setActiveRoom(info.code);
        if (mode === 'practice') {
          await server.start(info.code);
          go('#/play');
        } else go('#/lobby');
      }
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : String(e);
    }
  };
  draw();
  const title = mode === 'join' ? `방 ${code}에 참가` : mode === 'room' ? '방 만들기' : '연습 시즌';
  const element = h('section', { class: 'j-create' },
    h('h1', null, title),
    h('div', { class: 'j-card' }, h('label', null, '이름 ', name), h('label', null, '국적 ', nation), h('label', null, '주 손 ', hand)),
    h('div', { class: 'j-card' }, h('h2', null, '플레이 스타일'), styleRow),
    h('div', { class: 'j-card' }, h('h2', null, '재능 포인트 ', left, '/10 · ', ovrText), h('p', { class: 'j-muted' }, '모두 같은 OVR로 시작해요. 재능은 장단점의 모양을 바꿔요.'), talentRows, bars),
    h('div', { class: 'j-card' }, h('h2', null, '집중 훈련 (최대 2개)'), focusRow),
    error,
    h('button', { class: 'primary big', id: 'create', onclick: () => void submit() }, mode === 'join' ? '참가하기' : mode === 'room' ? '방 열기' : '시작하기'));
  return { element };
}
