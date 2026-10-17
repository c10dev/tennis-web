// Dev replay page (?seed=&surface=&mode=): simulate an exhibition match, or load replay JSON, and play it.
import { exhibitionConfig, fingerprint, simulateMatch, type MatchResult, type Surface } from '@tennis/engine';
import type { ViewMode } from '@tennis/renderer';
import { mountBroadcast } from './broadcast.ts';
import { sliceFromQuery } from './model.ts';
import { createPanel } from './panel.ts';

const params = new URLSearchParams(location.search);
const surface: Surface = (['hard', 'clay', 'grass'] as const).find((s) => s === params.get('surface')) ?? 'hard';
const seed = Number.parseInt(params.get('seed') ?? '42', 10) >>> 0;
const MODES: ViewMode[] = ['full', 'key', 'highlights', 'result'];
const mode: ViewMode = MODES.find((m) => m === params.get('mode')) ?? 'full';

const app = document.getElementById('app')!;
const stage = document.createElement('div');
const panelRoot = Object.assign(document.createElement('div'), { id: 'panel' });
app.append(stage, panelRoot);
const slice = await sliceFromQuery();
const broadcast = mountBroadcast(stage, { mode, ...(slice ?? {}) });
let current: MatchResult | null = null;
const panel = createPanel(panelRoot, { seed, surface }, (json, name) => start(json as MatchResult, name), () => current);

function start(result: MatchResult, source: string): void {
  let timeline;
  try {
    timeline = broadcast.load(result);
  } catch (err) {
    panel.error((err as Error).message);
    return;
  }
  current = result;
  const [a, b] = timeline.names;
  panel.show({ title: `${a} vs ${b} · ${timeline.surface} · ${source}`, fingerprint: fingerprint(result) });
}

document.title = 'TennisSim Replay';
start(simulateMatch(exhibitionConfig(surface), seed), `seed ${seed}`);
