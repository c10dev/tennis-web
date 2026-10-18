// A big match told in text (ADR-032/033): played again from its recipe, a line at a time, with a skip.
import { commentary, reached } from '@tennis/game';
import { h } from '../../lib/h.ts';
import { go } from '../../lib/router.ts';
import type { Screen } from '../app.ts';
import { activeRoom, clientFor } from '../session.ts';

const PACE_MS = 450;

export async function matchScreen(params: string[]): Promise<Screen> {
  const [n, kind, a, b] = [Number(params[0]), params[1], Number(params[2]), Number(params[3])];
  const code = activeRoom();
  const mine = code ? await clientFor(code).mine() : null;
  const r = mine?.state.reports[n];
  const event = kind === 'c' ? null : r?.events[a];
  const line = kind === 'c' ? r?.cup?.matches[b] : event?.matches[b];
  if (!mine || !line?.recipe) {
    go('#/play');
    return { element: h('div') };
  }
  const me = mine.state.user.player.name;
  const side = line.recipe.config.players[0].name === me ? 'A' : 'B';
  const where = event ? `${event.name} ${reached({ champion: false, roundsWon: line.round - 1, rounds: event.rounds })}` : '룸 컵';
  const lines = commentary(line.recipe, `${where} · ${me} vs ${line.opponentName}`, side);
  const list = h('ol', { class: 'j-commentary', id: 'commentary', 'aria-live': 'polite' });
  let shown = 0;
  const step = () => {
    const l = lines[shown++];
    if (!l) return stop();
    list.appendChild(h('li', { class: `j-c ${l.kind}${l.ours === undefined ? '' : l.ours ? ' ours' : ' theirs'}` }, l.text));
  };
  const timer = window.setInterval(step, PACE_MS);
  const stop = () => window.clearInterval(timer);
  const skip = () => {
    stop();
    while (shown < lines.length) step();
  };
  step();
  const element = h('section', { class: 'j-match' }, list,
    h('div', { class: 'j-row' }, h('button', { id: 'skip', onclick: skip }, '끝까지 보기'), h('button', { onclick: () => history.back() }, '돌아가기')));
  return { element, dispose: stop };
}
