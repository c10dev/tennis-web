// The opponent read on the decision screen (ADR-017): scouting, their cards so far, the tell, the head to head.
import type { OpponentRead } from '@tennis/game';
import { T, U } from '../i18n/index.ts';
import { h } from '../lib/h.ts';
import { cardIcon, icon } from '../lib/icons.ts';

export function renderRead(read: OpponentRead): HTMLElement {
  return h('div', { class: 'read', id: 'opponent-read' },
    h('span', { class: 'scouting', id: 'scouting' }, read.scouting),
    read.history.length ? h('span', { class: 'history', id: 'their-cards' }, h('span', { class: 'label' }, U.theirCards),
      read.history.map((x) => h('span', { class: `chip ${x.card}`, title: U.atScore(x.score) }, cardIcon(x.card, 14), ` ${T.card[x.card]} `, h('small', { class: 'at' }, x.score)))) : null,
    read.tell ? h('span', { class: 'tell', id: 'tell' }, icon('eye', 16), h('span', { class: 'label' }, U.tell), read.tell) : null,
    read.rival ? h('span', { class: 'rival', id: 'rival' }, read.rival) : null);
}
