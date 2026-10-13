import type { Summary } from '../src/match/metrics.ts';
import type { Target } from './targets.ts';

export interface Row {
  label: string;
  value: string;
  range: string;
  status: 'PASS' | 'FAIL' | 'info';
}

const fmt = (v: number, percent: boolean) => (percent ? `${(v * 100).toFixed(1)}%` : v.toFixed(2));

export function check(t: Target, s: Summary): Row {
  const v = s[t.key];
  const range = t.max === Number.POSITIVE_INFINITY ? `≥ ${fmt(t.min, t.percent)}` : `${fmt(t.min, t.percent)} – ${fmt(t.max, t.percent)}`;
  return { label: t.label, value: fmt(v, t.percent), range, status: v >= t.min && v <= t.max ? 'PASS' : 'FAIL' };
}

export function info(t: Target, s: Summary): Row {
  return { ...check(t, s), status: 'info' };
}

export function table(rows: Row[]): string {
  const w = [Math.max(...rows.map((r) => r.label.length)), 9, Math.max(13, ...rows.map((r) => r.range.length))];
  const line = (a: string, b: string, c: string, d: string) => `${a.padEnd(w[0]!)}  ${b.padStart(w[1]!)}  ${c.padEnd(w[2]!)}  ${d}`;
  return [line('Metric', 'Value', 'Target', 'Status'), ...rows.map((r) => line(r.label, r.value, r.range, r.status))].join('\n');
}
