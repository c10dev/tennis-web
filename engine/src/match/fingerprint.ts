// A short hash of a match's events: two runs, or two JS engines, produced the same match iff the hashes agree (TD-005).
import type { MatchResult } from '../types.ts';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit over the UTF-16 code units of `JSON.stringify(result.events)`, as 8 hex digits. */
export function fingerprint(result: MatchResult): string {
  const text = JSON.stringify(result.events);
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), FNV_PRIME) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
