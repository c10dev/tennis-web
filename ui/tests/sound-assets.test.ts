import { describe, expect, it } from 'vitest';

// The generated samples in ui/public/audio (TD-016, ADR-027) against their work order, docs/sound/manifest.json:
// only the ordered files, both formats of each, every file and the folder within budget, and the attribution notice.
// The UI's tests have no Node types (the package is browser code); fs comes in untyped.
const FS = 'node:fs';
const fs = (await import(FS)) as {
  readFileSync(path: URL, enc: 'utf8'): string;
  readdirSync(path: URL): string[];
  statSync(path: URL): { size: number };
};

interface Manifest {
  budget: { totalBytes: number };
  sounds: { id: string; budgetBytes: number }[];
}

const dir = new URL('../public/audio/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('../../docs/sound/manifest.json', import.meta.url), 'utf8')) as Manifest;
const files = fs.readdirSync(dir).filter((f) => f !== 'NOTICE.txt');
const size = (f: string) => fs.statSync(new URL(f, dir)).size;

describe('sound assets (ADR-027)', () => {
  it('holds only the sounds the manifest orders, as Opus and AAC', () => {
    const ids = new Set(manifest.sounds.map((s) => s.id));
    for (const f of files) {
      const m = /^([a-z-]+)\.(ogg|m4a)$/.exec(f);
      expect(m, f).not.toBeNull();
      expect(ids.has(m![1]!), f).toBe(true);
    }
  });

  it('has both formats of every sound it has', () => {
    for (const f of files) expect(files, f).toContain(f.endsWith('.ogg') ? f.replace(/ogg$/, 'm4a') : f.replace(/m4a$/, 'ogg'));
  });

  it('keeps each file within its budget and the folder within the total', () => {
    for (const s of manifest.sounds) {
      for (const ext of ['ogg', 'm4a']) {
        const f = `${s.id}.${ext}`;
        if (files.includes(f)) expect(size(f), f).toBeLessThanOrEqual(s.budgetBytes);
      }
    }
    expect(manifest.sounds.reduce((sum, s) => sum + 2 * s.budgetBytes, 0)).toBeLessThanOrEqual(manifest.budget.totalBytes);
    expect(files.reduce((sum, f) => sum + size(f), 0)).toBeLessThanOrEqual(manifest.budget.totalBytes);
  });

  it('ships the Stability AI attribution with the sounds', () => {
    const notice = fs.readFileSync(new URL('NOTICE.txt', dir), 'utf8');
    expect(notice).toContain('Powered by Stability AI');
    expect(notice).toContain('This Stability AI Model is licensed under the Stability AI Community License, Copyright © Stability AI Ltd. All Rights Reserved');
  });
});
