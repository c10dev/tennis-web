// Waiting for friends: who is ready, when the swing closes; it plays as soon as it is due, from whichever device sees
// it first (the server decides once).
import { h } from '../../lib/h.ts';
import { go } from '../../lib/router.ts';
import type { Screen } from '../app.ts';
import { remaining } from '../format.ts';
import { activeRoom, clientFor, loadDraft, roomServer } from '../session.ts';

export async function waitScreen(_params: string[], rerender: () => void): Promise<Screen> {
  const code = activeRoom();
  if (!code) {
    go('#/');
    return { element: h('div') };
  }
  const client = clientFor(code);
  const info = await roomServer().room(code);
  const status = await client.status(Date.now());
  if (status.due && (await client.advanceIfDue(Date.now()))) {
    go('#/play');
    return { element: h('div') };
  }
  const subs = await roomServer().submissions(code, info.swing);
  if (!subs[(await roomServer().me())]?.ready) {
    // Not ready for the open swing: either it was never sent, or another device has just played the swing this
    // screen was waiting on. #/play shows that swing's report first, then the plan.
    go('#/play');
    return { element: h('div') };
  }
  const unready = async () => {
    const draft = loadDraft(code, info.swing);
    const mine = subs[await roomServer().me()]!;
    await client.submit(draft ?? { answers: mine.answers, plan: mine.plan }, false);
    go('#/plan');
  };
  const clock = h('p', { class: 'j-muted', id: 'closes' }, remaining(status.closesAt - Date.now()));
  const element = h('section', { class: 'j-wait' },
    h('h1', null, '준비 완료'),
    h('div', { class: 'j-card' }, h('h2', null, '친구들'),
      h('ul', { class: 'j-list', id: 'ready-list' }, ...info.members.map((m) => h('li', { class: status.ready[m.id] ? 'ok' : '' }, h('b', null, m.name), status.ready[m.id] ? ' · 준비 완료' : ' · 계획 중'))),
      clock),
    h('p', { class: 'j-muted' }, '모두 준비하거나 마감 시간이 되면 구간이 진행돼요. 늦은 사람은 기본 계획으로 뛰어요.'),
    h('button', { id: 'unready', onclick: () => void unready() }, '계획 다시 고치기'));
  const off = roomServer().subscribe(code, rerender);
  const timer = window.setInterval(rerender, 30_000);
  return { element, dispose: () => { off(); window.clearInterval(timer); } };
}
