// Match source panel: simulate a seed on a surface (via the URL), load or save replay JSON, show the fingerprint.
import type { MatchResult, Surface } from '@tennis/engine';

export interface Panel {
  show(info: { title: string; fingerprint: string }): void;
  error(message: string): void;
}

export function createPanel(root: HTMLElement, current: { seed: number; surface: Surface }, onLoad: (result: unknown, name: string) => void,
  getResult: () => MatchResult | null): Panel {
  const form = document.createElement('form');
  const surface = document.createElement('select');
  for (const s of ['hard', 'clay', 'grass']) surface.add(new Option(s, s, false, s === current.surface));
  const seed = document.createElement('input');
  seed.type = 'number';
  seed.min = '0';
  seed.value = String(current.seed);
  seed.className = 'seed';
  const go = document.createElement('button');
  go.textContent = 'Simulate';
  form.append(surface, seed, go);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    location.search = new URLSearchParams({ seed: seed.value, surface: surface.value }).toString();
  });

  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    try {
      onLoad(JSON.parse(await chosen.text()), chosen.name);
    } catch (err) {
      message.textContent = `Could not read ${chosen.name}: ${(err as Error).message}`;
    }
  });
  const load = document.createElement('label');
  load.className = 'load';
  load.append('Load replay JSON ', file);
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Save JSON';
  save.addEventListener('click', () => {
    const result = getResult();
    if (!result) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(result)], { type: 'application/json' }));
    a.download = `replay-${result.config.surface}-${result.seed}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const meta = document.createElement('div');
  meta.className = 'meta';
  const message = document.createElement('div');
  message.className = 'error';
  root.append(form, load, save, meta, message);
  return {
    show({ title, fingerprint }) {
      message.textContent = '';
      const fp = document.createElement('code');
      fp.id = 'fingerprint';
      fp.textContent = fingerprint;
      meta.replaceChildren(`${title} · fingerprint `, fp);
    },
    error(text) {
      message.textContent = text;
    },
  };
}
