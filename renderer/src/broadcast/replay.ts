// Replays (GDD §8.3): which points get one, and the clips inserted in the pause after them.
import type { PointSegment, Timeline } from '../playback/timeline.ts';
import { BROADCAST } from '../tuning/index.ts';
import { lineCall } from './hawkeye.ts';
import type { Insert } from './programme.ts';
import type { Clip } from './types.ts';

const landedAt = (s: PointSegment) => {
  const last = s.point.shots.at(-1)!;
  return s.zero + last.t + last.flightSec;
};

/** The point's last bounce was within the Hawk-Eye margin of a line. */
export function isCloseCall(s: PointSegment): boolean {
  const call = lineCall(s.point, s.point.shots.at(-1)!);
  return call !== null && Math.abs(call.marginM) <= BROADCAST.hawkeyeMarginM;
}

/** Winners after a rally, long rallies, converted break, set and match points, and close calls. */
export function wantsReplay(s: PointSegment): boolean {
  const p = s.point;
  const converted = (p.tags.includes('break_point') && p.winner !== p.server)
    || (p.tags.includes('set_point') && (s.gap === 'set_end' || s.gap === 'match_end'))
    || (p.tags.includes('match_point') && s.gap === 'match_end');
  return (p.endedBy === 'winner' && p.rallyLength >= BROADCAST.winnerRally) || p.rallyLength >= BROADCAST.longRally
    || converted || isCloseCall(s);
}

/** After the reaction shot: the last seconds again at half speed from the side, then Hawk-Eye on a close call. */
export function replayInserts(timeline: Timeline, index: number): Insert | null {
  const s = timeline.segments[index]!;
  if (!wantsReplay(s)) return null;
  const landed = landedAt(s);
  const at = Math.min(landed + BROADCAST.reactionSec, s.next - BROADCAST.serveCamLeadSec);
  const from = Math.max(s.start, landed - BROADCAST.replayLeadSec);
  const to = landed + BROADCAST.replayTailSec;
  const clips: Omit<Clip, 'start'>[] = [{
    kind: 'replay', duration: (to - from) / BROADCAST.replayRate, matchFrom: from, rate: BROADCAST.replayRate, camera: 'side',
    pointIndex: index, scoreTime: at,
  }];
  if (isCloseCall(s)) {
    clips.push({ kind: 'hawkeye', duration: BROADCAST.hawkeyeSec, matchFrom: landed, rate: 0, camera: 'hawkeye', pointIndex: index, scoreTime: at });
  }
  return { at, clips };
}
