// The swing's plan (ADR-033): answer what is waiting, pick events on the calendar, hire or release staff, choose the
// training focus, then make ready. The draft is kept on this device until it is sent.
import { autoPlan, choose, currentChoice, GROUP_KO, GROUPS, groupValues, journeyRankOf, ovr, rankingTotal, SWINGS, validatePlan, type JourneyState, type Role, type Submission } from '@tennis/game';
import { h } from '../../lib/h.ts';
import { go } from '../../lib/router.ts';
import type { Screen } from '../app.ts';
import { money, pct, rankText, remaining } from '../format.ts';
import { activeRoom, clientFor, loadDraft, saveDraft } from '../session.ts';
import { calendar, choiceCard, teamCard } from './plan-parts.ts';

export async function planScreen(): Promise<Screen> {
  const code = activeRoom();
  if (!code) {
    go('#/');
    return { element: h('div') };
  }
  const client = clientFor(code);
  const mine = await client.mine();
  if (!mine) {
    go('#/lobby');
    return { element: h('div') };
  }
  const { synced, state } = mine;
  const swing = synced.info.swing;
  let draft: Submission = loadDraft(code, swing) ?? { answers: [], plan: autoPlan(state, 'smart', state.user.focus) };
  const root = h('section', { class: 'j-plan' });
  const error = h('p', { class: 'j-error-text', role: 'alert', id: 'plan-error' });

  /** The player's state once this draft's answers are applied, and what the answers said. */
  const answered = (): { s: JourneyState; notes: string[] } => {
    let s = state;
    const notes: string[] = [];
    for (const a of draft.answers) {
      if (!s.pending.length) break;
      const out = choose(s, a);
      s = out.state;
      if (out.note) notes.push(out.note);
    }
    return { s, notes };
  };
  const update = (next: Submission) => {
    draft = next;
    saveDraft(code, swing, draft);
    draw();
  };

  const draw = () => {
    const { s, notes } = answered();
    const p = s.user.player;
    const g = groupValues(p);
    const choice = currentChoice(s);
    const head = h('div', { class: 'j-card j-me' },
      h('p', { class: 'j-eyebrow' }, `${2026 + s.year}시즌 · ${SWINGS[s.swing]!.name} · ${remaining(synced.info.openedAt + synced.info.deadlineMs - Date.now())}`),
      h('h1', null, p.name),
      h('p', { id: 'me-line' }, `${p.age}세 · OVR ${ovr(p)} · ${rankText(journeyRankOf(p, s.pros, s.points))} (${rankingTotal(s.points[p.id])}점) · ${money(s.user.money)}`),
      h('p', { class: 'j-muted' }, `사기 ${s.user.morale} · 명성 ${s.user.reputation} · 피로 ${pct(p.fatigue)}`),
      h('div', { class: 'j-bars' }, ...GROUPS.map((k) => h('div', { class: 'j-bar' }, h('span', null, GROUP_KO[k]), h('i', { style: `--v:${g[k]}` }), h('b', null, g[k])))),
      ...notes.map((n) => h('p', { class: 'j-note' }, n)), ...s.notes.map((n) => h('p', { class: 'j-note' }, n)));
    if (choice) {
      root.replaceChildren(head, choiceCard(choice, (id) => update({ ...draft, answers: [...draft.answers, id] })));
      return;
    }
    const plan = draft.plan;
    const toggle = (id: string) => update({ ...draft, plan: { ...plan, events: plan.events.includes(id) ? plan.events.filter((e) => e !== id) : [...plan.events, id] } });
    const hire = (id: string) => {
      const role = id.split('-')[0] as Role;
      const others = (plan.hire ?? []).filter((x) => !x.startsWith(`${role}-`));
      update({ ...draft, plan: { ...plan, hire: plan.hire?.includes(id) ? others : [...others, id] } });
    };
    const release = (role: Role) => update({ ...draft, plan: { ...plan, release: plan.release?.includes(role) ? plan.release.filter((r) => r !== role) : [...(plan.release ?? []), role] } });
    const focusRow = h('div', { class: 'j-chips', id: 'focus' }, ...GROUPS.map((k) => h('button', {
      class: plan.focus.includes(k) ? 'chip on' : 'chip', 'aria-pressed': String(plan.focus.includes(k)),
      onclick: () => update({ ...draft, plan: { ...plan, focus: plan.focus.includes(k) ? plan.focus.filter((x) => x !== k) : [...plan.focus, k].slice(-2) } }),
    }, GROUP_KO[k])));
    const ready = async () => {
      const errors = validatePlan(s, plan);
      if (errors.length) {
        error.textContent = errors.includes('money') ? '돈이 모자라요' : `계획을 확인해 주세요 (${errors.join(', ')})`;
        return;
      }
      await client.submit(draft, true);
      go('#/wait');
    };
    root.replaceChildren(head, calendar(s, plan, toggle), h('div', { class: 'j-card' }, h('h2', null, '집중 훈련 (최대 2개)'), focusRow), teamCard(s, plan, hire, release),
      error, h('button', { class: 'primary big', id: 'ready', onclick: () => void ready() }, '준비 완료'));
  };
  draw();
  return { element: root };
}
