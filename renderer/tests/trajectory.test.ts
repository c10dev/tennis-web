import { describe, expect, it } from 'vitest';
import type { ShotEvent } from '@tennis/engine';
import { flightPosition, gravityArc, netCrossing, tossPosition } from '../src/playback/trajectory.ts';
import { BALL, NET } from '../src/tuning/index.ts';
import { SAMPLE } from './fixtures.ts';

const shots = SAMPLE.flatMap((r) => r.events.flatMap((e) => (e.type === 'point' ? e.shots : [])));
const sNet = (s: ShotEvent) => s.from.y / (s.from.y - s.bounce!.y);

describe('flightPosition (contact → bounce)', () => {
  it('starts at the contact point and lands on the bounce', () => {
    for (const s of shots.filter((x) => x.bounce)) {
      expect(flightPosition(s, 0)).toEqual(s.from);
      const end = flightPosition(s, 1);
      expect(end.x).toBeCloseTo(s.bounce!.x, 9);
      expect(end.y).toBeCloseTo(s.bounce!.y, 9);
      expect(end.z).toBeCloseTo(0, 9);
    }
  });

  it('crosses the net at the recorded clearance, or higher when that would bend the arc upwards', () => {
    let exact = 0;
    for (const s of shots.filter((x) => x.bounce)) {
      const atNet = flightPosition(s, sNet(s)).z;
      const wanted = NET.centerHeight + s.netClearance;
      expect(atNet).toBeGreaterThanOrEqual(wanted - 1e-9);
      if (Math.abs(atNet - wanted) < 1e-9) exact++;
    }
    expect(exact / shots.filter((x) => x.bounce).length).toBeGreaterThan(0.95);
  });

  it('never goes below the ground before the bounce', () => {
    for (const s of shots.filter((x) => x.bounce)) {
      for (let k = 0; k <= 50; k++) expect(flightPosition(s, k / 50).z).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('flattens a fit that would bend upwards (a smash next to the net) into a line above the ground', () => {
    const smash = { ...shots.find((x) => x.bounce)!, from: { x: 0, y: -1, z: 2.5 }, bounce: { x: 0, y: 8 }, netClearance: 0.1 };
    const atNet = flightPosition(smash, netCrossing(smash)!).z;
    expect(atNet).toBeCloseTo(2.5 * (1 - 1 / 9), 9);
    expect(atNet).toBeGreaterThan(NET.centerHeight + smash.netClearance);
    for (let k = 0; k <= 20; k++) expect(flightPosition(smash, k / 20).z).toBeGreaterThanOrEqual(0);
  });

  it('flies a ball that hits the net to the tape height recorded, at the centre line between contact x and 0', () => {
    for (const s of shots.filter((x) => !x.bounce)) {
      const end = flightPosition(s, 1);
      expect(end.y).toBeCloseTo(0, 9);
      expect(end.x).toBeCloseTo(s.from.x * 0.5, 9);
      expect(end.z).toBeCloseTo(NET.centerHeight + s.netClearance, 9);
      expect(end.z).toBeLessThan(NET.centerHeight);
      expect(netCrossing(s)).toBeNull();
    }
  });
});

describe('gravityArc', () => {
  it('joins two heights in the given time under gravity', () => {
    expect(gravityArc(0, 1.2, 0.45, 0)).toBeCloseTo(0, 9);
    expect(gravityArc(0, 1.2, 0.45, 0.45)).toBeCloseTo(1.2, 9);
    const mid = gravityArc(0, 0, 1, 0.5);
    expect(mid).toBeCloseTo((BALL.gravity * 1) / 8, 9);
  });
});

describe('tossPosition', () => {
  it('rises from the hand above the contact point and comes down onto it at contact', () => {
    const serve = shots.find((s) => s.shot === 'serve')!;
    const start = tossPosition(serve, 0);
    expect(start.z).toBeCloseTo(BALL.tossStartHeight, 9);
    const end = tossPosition(serve, 1);
    expect(end.x).toBe(serve.from.x);
    expect(end.y).toBe(serve.from.y);
    expect(end.z).toBeCloseTo(serve.from.z, 9);
    const peak = Math.max(...Array.from({ length: 21 }, (_, k) => tossPosition(serve, k / 20).z));
    expect(peak).toBeGreaterThan(serve.from.z);
  });
});
