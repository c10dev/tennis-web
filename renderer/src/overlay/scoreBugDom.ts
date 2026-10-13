// Draws a ScoreBugModel as DOM (GDD §8.2). Names come from replay files, so text is only ever set with textContent.
import type { ScoreBugModel } from './scoreBug.ts';

export interface ScoreBugView {
  readonly element: HTMLElement;
  update(model: ScoreBugModel): void;
}

const cell = (tag: 'td' | 'th', className: string, text: string) => {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
};

export function createScoreBug(): ScoreBugView {
  const element = document.createElement('table');
  element.className = 'score-bug';
  let last = '';
  return {
    element,
    update(model) {
      const key = JSON.stringify(model);
      if (key === last) return;
      last = key;
      element.replaceChildren(...model.rows.map((row) => {
        const tr = document.createElement('tr');
        if (row.winner) tr.className = 'winner';
        tr.append(cell('td', 'serve', row.serving ? '●' : ''), cell('th', 'name', row.name));
        for (const games of row.sets) tr.append(cell('td', 'set', String(games)));
        if (row.games !== null) tr.append(cell('td', 'games', String(row.games)));
        if (!model.final) tr.append(cell('td', model.tiebreak ? 'points tiebreak' : 'points', row.points));
        if (row.winner) tr.append(cell('td', 'check', '✓'));
        return tr;
      }));
    },
  };
}
