// The decisive point replayed in 3D on the result screen (ADR-017): full screen with the line as a caption, removed
// when it ends or on skip. Split out of result.ts, which keeps the reveal's order.
import { SCHEMA_VERSION, replayMatch, type MatchRecipe, type PointEvent } from '@tennis/engine';
import { QUICK_PACE, QUICK_REWARD } from '@tennis/game';
import { h } from '../lib/h.ts';
import type { Sequence } from '../lib/motion.ts';
import type { AppSound } from '../lib/sound.ts';

export interface DecisiveReplay {
  /** Where the full-screen stage goes. */
  host: HTMLElement;
  recipe: MatchRecipe;
  /** The decisive point's index, the score before it, and the line naming the choice. */
  point: number;
  score: string;
  line: string;
  sound: AppSound;
  /** Called when the clip starts moving (after the 3D code and shaders are ready). */
  onPlay(): void;
}

export async function replayDecisive(s: Sequence, r: DecisiveReplay): Promise<void> {
  const stage = h('div', { class: 'decisive-replay', id: 'decisive-replay' });
  const caption = h('div', { class: 'replay-caption' }, h('span', { class: 'kicker' }, `The decisive point · ${r.score}`), h('strong', null, r.line));
  r.host.append(stage);
  const { mountBroadcast } = await import('../replay/broadcast.ts');
  if (s.skipped) {
    stage.remove();
    return;
  }
  const broadcast = mountBroadcast(stage, { mode: 'full', controls: false, bare: true, sound: r.sound });
  stage.append(caption);
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    broadcast.dispose();
    stage.remove();
  };
  s.onSkip(close);
  if (s.skipped) return;
  const timeline = broadcast.load({ schemaVersion: SCHEMA_VERSION, config: r.recipe.config, events: replayMatch(r.recipe).events });
  const seg = timeline.segments.find((x) => x.point.index === r.point)!;
  const p: PointEvent = seg.point;
  await broadcast.ready();
  if (s.skipped) return;
  r.onPlay();
  await broadcast.playWindow(seg.zero + Math.max(-QUICK_PACE.tossSec, p.durationSec - QUICK_PACE.keyMaxSec), seg.zero + p.durationSec, QUICK_REWARD.reveal.replaySpeed);
  await s.wait(QUICK_REWARD.reveal.holdSec);
  if (!s.skipped) close();
}
