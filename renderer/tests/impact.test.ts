// The impact moment S3 (ADR-024, slice step 5): on the deciding ace or winner of a decisive point, the game programme
// slows into the contact, holds it for a hit-stop and slows out, on the impact camera; rationed, never two in a row.
import { describe, expect, it } from 'vitest';
import { allCues } from '../src/audio/cues.ts';
import { isDecisive } from '../src/broadcast/director.ts';
import { buildProgramme, programmeTimeFor } from '../src/broadcast/programme.ts';
import type { Clip } from '../src/broadcast/types.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { BROADCAST } from '../src/tuning/index.ts';
import { SAMPLE } from './fixtures.ts';

const I = BROADCAST.impact;
const impactOf = (clips: Clip[], index: number) => clips.filter((c) => c.pointIndex === index && (c.kind === 'slowmo' || c.kind === 'hitstop'));

describe('impact moment', () => {
  for (const [n, r] of SAMPLE.slice(0, 4).entries()) {
    const tl = buildTimeline(r);
    for (const bare of [false, true]) {
      it(`slows, holds and slows again on the deciding shot, back to back with live play (match ${n + 1}${bare ? ', quick-match programme' : ''})`, () => {
        const p = bare ? buildProgramme(tl, 'full', () => null, { intro: false, style: 'game' }) : buildProgramme(tl, 'full', undefined, { style: 'game' });
        for (let i = 1; i < p.clips.length; i++) expect(p.clips[i]!.start).toBeCloseTo(p.clips[i - 1]!.start + p.clips[i - 1]!.duration, 9);
        let shown = 0;
        let previous = false;
        tl.segments.forEach((seg, index) => {
          const clips = impactOf(p.clips, index);
          const wanted = isDecisive(seg) && (seg.point.endedBy === 'ace' || seg.point.endedBy === 'winner') && !previous;
          previous = clips.length > 0;
          if (!wanted) {
            expect(clips, `point ${index}`).toHaveLength(0);
            return;
          }
          shown++;
          const contact = seg.zero + seg.point.shots.at(-1)!.t;
          expect(clips.map((c) => c.kind)).toEqual(['slowmo', 'hitstop', 'slowmo']);
          const [into, hold, out] = clips as [Clip, Clip, Clip];
          expect(into).toMatchObject({ matchFrom: contact - I.leadSec, rate: I.rate, camera: 'impact', focus: seg.point.shots.at(-1)!.hitter });
          expect(into.duration).toBeCloseTo(I.leadSec / I.rate, 9);
          expect(hold).toMatchObject({ matchFrom: contact, rate: 0, duration: I.hitstopSec, camera: 'impact' });
          expect(out.matchFrom).toBeCloseTo(contact, 9);
          expect(out.duration).toBeCloseTo(I.tailSec / I.rate, 9);
          const after = p.clips[p.clips.indexOf(out) + 1]!;
          expect(after.kind).toBe('live');
          expect(after.matchFrom).toBeCloseTo(contact + I.tailSec, 9);
        });
        expect(shown).toBeGreaterThan(0);
        // Programme time still finds live play either side of the moment.
        const seg = tl.segments.find((s, i) => impactOf(p.clips, i).length)!;
        expect(programmeTimeFor(p, seg.start + 0.01)).toBeGreaterThan(0);
      });
    }
  }

  it('keeps the broadcast programme as it was', () => {
    const p = buildProgramme(buildTimeline(SAMPLE[0]!), 'full');
    expect(p.clips.some((c) => c.kind === 'slowmo' || c.kind === 'hitstop' || c.camera === 'impact')).toBe(false);
  });

  it('plays the deciding hit’s sound once, as the slow motion reaches the contact', () => {
    const tl = buildTimeline(SAMPLE[1]!);
    const p = buildProgramme(tl, 'full', undefined, { style: 'game' });
    const index = tl.segments.findIndex((_, i) => impactOf(p.clips, i).length);
    const [into] = impactOf(p.clips, index) as [Clip];
    const hits = allCues(p).filter((c) => c.kind === 'hit' && Math.abs(c.at - (into.start + into.duration)) < 1e-6);
    expect(hits).toHaveLength(1);
  });
});
