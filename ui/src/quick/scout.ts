// The opponent read on the decision screen (ADR-017): scouting, their cards so far, the tell.
import { CARD_LABEL, type OpponentRead } from '@tennis/game';
import { h } from '../lib/h.ts';

export function renderRead(read: OpponentRead): HTMLElement {
  return h('div', { class: 'read', id: 'opponent-read' },
    h('span', { class: 'scouting', id: 'scouting' }, read.scouting),
    read.history.length ? h('span', { class: 'history', id: 'their-cards' }, read.history.map((x) => h('span', { class: `chip ${x.card}`, title: `at ${x.score}` }, CARD_LABEL[x.card]))) : null,
    read.tell ? h('span', { class: 'tell', id: 'tell' }, read.tell) : null,
    read.rival ? h('span', { class: 'rival', id: 'rival' }, read.rival) : null);
}
