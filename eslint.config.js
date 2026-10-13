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
    // CLAUDE.md rules 1 and 2: the engine is deterministic and knows nothing about rendering.
    files: ['engine/src/**/*.ts'],
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
);
