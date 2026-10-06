// Lint rules. Three project-specific rules:
//   1. No raw text in JSX: all words come from src/constants/ (PRP F8).
//   2. Environment variables are read only in src/constants/app.constants.ts.
//   3. Only src/services/ talks to a backend (Web3Forms now, Supabase from Release 2).

import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['build/', '.react-router/', 'node_modules/'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    settings: { react: { version: '19.3' } },
    rules: {
      // Rule 1: no hard-coded text in JSX.
      'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }],

      // Never render raw HTML: staff bios and qualifications are shown as text (R2a G16).
      'react/no-danger': 'error',

      // Rule 3: only the service layer talks to a backend. Everyone else imports from '@/services'.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*'],
              message:
                'Only src/services/ may talk to Supabase. Call a function from "@/services".',
            },
            {
              group: ['@/services/*', '**/services/*'],
              message: 'Import from "@/services" (the index), not from files inside it.',
            },
          ],
        },
      ],

      // Rule 2: import.meta.env only in app.constants.ts.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.type='MetaProperty'][property.name='env']",
          message: 'Read environment variables only in src/constants/app.constants.ts.',
        },
      ],
    },
  },

  // Where the rules above don't apply.
  {
    files: ['src/constants/**', '**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'react/jsx-no-literals': 'off',
    },
  },
  {
    files: ['src/constants/app.constants.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/services/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
