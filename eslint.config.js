import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'coverage/', 'dist/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // noUncheckedIndexedAccess makes every array index optional; `!` on an index we just bounded is the plain idiom.
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // CLAUDE.md rules 1 and 2: the engine and the game layer are deterministic and know nothing about rendering.
    files: ['engine/src/**/*.ts', 'game/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Inject the seeded RNG instead.' },
        { object: 'Date', property: 'now', message: 'The engine must not read the clock.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'performance', message: 'The engine must not read the clock.' },
        { name: 'window', message: 'No DOM in the engine.' },
        { name: 'document', message: 'No DOM in the engine.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'The engine must not read the clock.' },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['**/renderer/**', '**/ui/**', 'three', 'three/*', 'node:*', 'fs', 'path'] },
      ],
    },
  },
  {
    // The game layer (ADR-011) uses the engine's public index only, and knows nothing about rendering or the UI.
    files: ['game/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/engine/**', '@tennis/engine/*'], message: "Import from '@tennis/engine' only." },
            { group: ['**/renderer/**', '@tennis/renderer', '**/ui/**', '@tennis/ui', 'three', 'three/*', 'node:*', 'fs', 'path'], message: 'The game layer is headless and deterministic.' },
          ],
        },
      ],
    },
  },
  {
    // ADR-001: the renderer consumes events through the engine's public index and knows nothing about ui/.
    files: ['renderer/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/engine/**', '@tennis/engine/*'], message: "Import from '@tennis/engine' only." },
            { group: ['**/ui/**', '@tennis/ui', '@tennis/ui/*'], message: 'The renderer must not depend on ui/.' },
          ],
        },
      ],
    },
  },
  {
    files: ['ui/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/engine/**', '@tennis/engine/*', '**/renderer/**', '@tennis/renderer/*', '!@tennis/renderer/audio'], message: 'Import workspace packages by name (or @tennis/renderer/audio, the mixer without Three.js).' },
          ],
        },
      ],
    },
  },
);
