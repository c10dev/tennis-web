// After a swing (ADR-033): the room first (standings, friends' matches, the cup), then this player's swing: headlines,
// results, what the team says, and the books.
import { GROUP_KO, GROUPS, press, reached, roomReport, SWINGS, type MatchLine, type SwingReport } from '@tennis/game';
import { h } from '../../lib/h.ts';
import { go } from '../../lib/router.ts';
import type { Screen } from '../app.ts';
import { money, rankText, ROLE, TIER } from '../format.ts';
import { activeRoom, clientFor, markReportSeen } from '../session.ts';

const matchLink = (n: number, kind: 'e' | 'c', a: number, b: number) => `#/match/${n}/${kind}/${a}/${b}`;

function lineItem(m: MatchLine, href: string | null): HTMLElement {
  return h('li', { class: m.won ? 'won' : 'lost' }, `${m.won ? '승' : '패'} ${m.score} vs ${m.opponentName}${m.opponentRank ? ` (${m.opponentRank}위)` : ''}`,
    href ? h('a', { href, class: 'j-watch' }, ' 중계 보기') : null);
}

export async function reportScreen(params: string[]): Promise<Screen> {
  const code = activeRoom();
  const mine = code ? await clientFor(code).mine() : null;
  if (!code || !mine) {
    go('#/play');
    return { element: h('div') };
  }
  const { synced, state } = mine;
  const n = Math.min(Number(params[0] ?? synced.info.swing - 1), state.reports.length - 1);
  const r: SwingReport | undefined = state.reports[n];
  if (!r) {
    go('#/plan');
    return { element: h('div') };
  }
  const all = Object.fromEntries(synced.room.order.map((id) => [id, synced.room.humans[id]!.reports[n]!]).filter(([, x]) => x));
  const room = roomReport(synced.room, all);
  const p = press(r, state);
  const multi = synced.room.order.length > 1;

  const roomCard = multi ? h('div', { class: 'j-card', id: 'room-report' },
    h('h2', null, '방 순위'),
    h('ol', { class: 'j-standings' }, ...room.standings.map((st) => h('li', { class: st.id === synced.playerId ? 'me' : '' },
      h('b', null, st.name), ` ${rankText(st.rank)}${st.change ? ` (${st.change > 0 ? '▲' : '▼'}${Math.abs(st.change)})` : ''} · 시즌 ${st.seasonPoints}점 · OVR ${st.ovr}${st.cups ? ` · 룸 컵 ${st.cups}회` : ''}`))),
    h('ul', { class: 'j-feed', id: 'room-feed' }, ...room.feed.map((f) => h('li', null, f)))) : null;

  const events = r.events.map((e, ei) => h('div', { class: 'j-result' },
    h('h3', null, `${e.name} · ${reached(e)}`, h('span', { class: 'j-muted' }, ` ${TIER[e.tier]} · +${e.points}점`)),
    h('ul', { class: 'j-matches' }, ...e.matches.map((m, mi) => lineItem(m, m.recipe ? matchLink(n, 'e', ei, mi) : null)))));
  const cup = r.cup ? h('div', { class: 'j-result', id: 'cup' }, h('h3', null, `룸 컵${r.cup.champion ? ' · 우승' : ''}`),
    h('ul', { class: 'j-matches' }, ...r.cup.matches.map((m, mi) => lineItem(m, m.recipe ? matchLink(n, 'c', 0, mi) : null)))) : null;
  const deltas = GROUPS.map((g) => ({ g, d: r.groupsAfter[g] - r.groupsBefore[g] })).filter((x) => x.d !== 0);

  const element = h('section', { class: 'j-report' },
    h('p', { class: 'j-eyebrow' }, `${2026 + r.year}시즌 · ${SWINGS[r.swing]!.name} 결과`),
    ...p.toasts.map((t) => h('p', { class: 'j-toast' }, t)),
    roomCard,
    h('div', { class: 'j-card', id: 'headlines' }, ...p.headlines.map((x) => h('p', { class: `j-headline ${x.tone}` }, x.text))),
    h('div', { class: 'j-card', id: 'my-swing' },
      h('h2', null, '내 구간'),
      h('p', null, `${rankText(r.rankBefore)} → ${rankText(r.rankAfter)} · OVR ${r.ovrBefore} → ${r.ovrAfter}`),
      deltas.length ? h('p', { class: 'j-muted' }, deltas.map((x) => `${GROUP_KO[x.g]} ${x.d > 0 ? '+' : ''}${x.d}`).join(' · ')) : null,
      ...events, cup,
      r.skipped.length ? h('p', { class: 'j-muted' }, `본선에 못 든 대회 ${r.skipped.length}개`) : null,
      r.events.length === 0 && !r.cup ? h('p', { class: 'j-muted' }, '이번 구간은 코트에 서지 않았어요.') : null),
    h('div', { class: 'j-card', id: 'staff' }, h('h2', null, '팀의 한마디'),
      ...p.staff.map((l) => h('p', { class: 'j-staff-line' }, h('b', null, l.who === 'self' ? '일지' : `${ROLE[l.who]} ${l.name}`), ` ${l.text}`))),
    h('div', { class: 'j-card' }, h('h2', null, '정산'),
      h('p', null, `상금 ${money(r.prize)} · 스폰서 ${money(r.sponsor)} · 인건비 ${money(-r.wages)} · 합계 ${money(r.money)}`),
      r.staffLeft.length ? h('p', { class: 'j-warn' }, `팀을 떠난 사람: ${r.staffLeft.join(', ')}`) : null),
    h('button', { class: 'primary big', id: 'next-plan', onclick: () => { markReportSeen(code, synced.info.swing); go('#/play'); } }, '다음 구간 계획'));
  return { element };
}
