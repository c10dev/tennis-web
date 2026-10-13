// Row helpers shared by the quick-match report sections.
import type { Row } from '../../engine/cli/report.ts';

export type Unit = '' | '%' | 's' | 'bits';
export const fmt = (v: number, unit: Unit) => (unit === '%' ? `${(v * 100).toFixed(1)}%` : unit === 's' ? `${v.toFixed(0)} s` : unit === 'bits' ? `${v.toFixed(2)} b` : v.toFixed(1));
export const check = (label: string, v: number, t: { min: number; max: number }, unit: Unit = ''): Row =>
  ({ label, value: fmt(v, unit), range: `${fmt(t.min, unit)} – ${fmt(t.max, unit)}`, status: v >= t.min && v <= t.max ? 'PASS' : 'FAIL' });
/** A target whose measure is not built yet: reported, never failing. */
export const notYet = (label: string, t: { min: number; max: number }, unit: Unit = ''): Row =>
  ({ label, value: '—', range: `${fmt(t.min, unit)} – ${fmt(t.max, unit)}`, status: 'info' });
export const info = (label: string, value: string): Row => ({ label, value, range: '', status: 'info' });
