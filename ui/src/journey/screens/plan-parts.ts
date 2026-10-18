// Parts of the plan screen (ADR-033): the choices waiting first, the 12-week calendar with each event's entry,
// points to defend and the fatigue the plan builds, and the team market.
import { fatigueForecast, forecast, market, ROLES, SWING_WEEKS, weeksOf, type ChoiceView, type JourneyState, type Plan, type Role } from '@tennis/game';
import { h } from '../../lib/h.ts';
import { COACH_STYLE, entryLabel, money, REGION, ROLE, SURFACE, TIER } from '../format.ts';

export function choiceCard(c: ChoiceView, pick: (id: string) => void): HTMLElement {
  return h('div', { class: 'j-card j-choice', id: 'choice' },
    h('p', { class: 'j-eyebrow' }, c.kind === 'stage' ? '갈림길' : c.kind === 'offer' ? '제안' : '이번 구간의 일'),
    h('h2', null, c.title), h('p', null, c.text),
    ...c.options.map((o) => h('button', { class: 'j-option', dataset: { option: o.id }, onclick: () => pick(o.id) }, h('b', null, o.label), h('span', null, o.detail))));
}

export function calendar(s: JourneyState, plan: Plan, toggle: (id: string) => void): HTMLElement {
  const info = forecast(s);
  const picked = new Set(plan.events);
  const taken = new Set(info.filter((f) => picked.has(f.event.id)).flatMap((f) => weeksOf(f.event)));
  const fatigue = fatigueForecast(s, plan);
  const away = s.user.injury > 0;
  const rows: HTMLElement[] = [];
  for (let w = 1; w <= SWING_WEEKS; w++) {
    const starting = info.filter((f) => f.event.week === w && f.allowed);
    const cards = starting.map((f) => {
      const on = picked.has(f.event.id);
      const clash = !on && weeksOf(f.event).some((x) => taken.has(x));
      const blocked = away || clash || f.entry === 'out';
      return h('button', {
        class: `j-event${on ? ' on' : ''}`, 'aria-pressed': String(on), disabled: blocked && !on, dataset: { event: f.event.id, entry: f.entry },
        onclick: () => toggle(f.event.id),
      },
      h('b', null, f.event.name),
      h('span', null, `${TIER[f.event.tier]} · ${SURFACE[f.event.surface]} · ${REGION[f.event.region]}${f.event.weeks === 2 ? ' · 2주' : ''}`),
      h('span', { class: `j-entry ${f.entry}` }, entryLabel(f.entry, f.qualify), f.defending ? ` · 방어 ${f.defending}점` : ''));
    });
    const level = fatigue.byWeek[w - 1]!;
    rows.push(h('div', { class: 'j-week' }, h('span', { class: 'j-wk' }, `${w}주`), h('div', { class: 'j-week-events' }, ...(cards.length ? cards : [h('span', { class: 'j-muted' }, taken.has(w) ? '대회 중' : '휴식·훈련')])),
      h('i', { class: 'j-fatigue', style: `--v:${Math.round(level * 100)}`, title: `피로 ${Math.round(level * 100)}%` })));
  }
  return h('div', { class: 'j-card', id: 'calendar' },
    h('h2', null, '일정 짜기'),
    away ? h('p', { class: 'j-warn' }, s.user.away === 'service' ? '군 복무 중이라 이번 구간은 대회에 나갈 수 없어요.' : '부상 회복 중이라 이번 구간은 쉬어요.') : null,
    h('p', { class: 'j-muted', id: 'fatigue-risk' }, `피로 최고 ${Math.round(fatigue.peak * 100)}% · 부상 위험 ${fatigue.risk === 'high' ? '높음' : fatigue.risk === 'medium' ? '보통' : '낮음'}`),
    ...rows);
}

export function teamCard(s: JourneyState, plan: Plan, hire: (id: string) => void, release: (role: Role) => void): HTMLElement {
  const offers = market(s);
  const hired = new Set(plan.hire ?? []);
  const releasing = new Set(plan.release ?? []);
  const stars = (q: number) => '★'.repeat(q) + '☆'.repeat(5 - q);
  const wages = ROLES.reduce((a, r) => a + (releasing.has(r) ? 0 : s.user.team[r]?.salary ?? 0), 0) + offers.filter((o) => hired.has(o.id)).reduce((a, o) => a + o.salary, 0);
  return h('div', { class: 'j-card', id: 'team' },
    h('h2', null, '팀'),
    h('p', { class: 'j-muted' }, `잔고 ${money(s.user.money)} · 이번 구간 인건비 ${money(wages)}`),
    ...ROLES.map((role) => {
      const cur = s.user.team[role];
      return h('div', { class: 'j-role', dataset: { role } },
        h('h3', null, ROLE[role]),
        cur ? h('p', null, h('b', null, cur.name), ` ${stars(cur.quality)} · ${money(cur.salary)}/구간 · 계약 ${cur.swingsLeft}구간`, cur.style ? ` · ${COACH_STYLE[cur.style]}` : '',
          h('button', { class: releasing.has(role) ? 'chip on' : 'chip', onclick: () => release(role) }, releasing.has(role) ? '내보내기 취소' : '내보내기')) : h('p', { class: 'j-muted' }, '없음'),
        h('div', { class: 'j-market' }, ...offers.filter((o) => o.role === role).map((o) => h('button', {
          class: `j-staff${hired.has(o.id) ? ' on' : ''}`, 'aria-pressed': String(hired.has(o.id)), dataset: { staff: o.id }, onclick: () => hire(o.id),
        }, h('b', null, o.name), h('span', null, `${stars(o.quality)} · ${money(o.salary)}/구간`), o.style ? h('span', null, COACH_STYLE[o.style]) : null))));
    }));
}
