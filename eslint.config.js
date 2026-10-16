import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import promise from 'eslint-plugin-promise';
import playwright from 'eslint-plugin-playwright';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import unicorn from 'eslint-plugin-unicorn';
import vue from 'eslint-plugin-vue';
import vueA11y from 'eslint-plugin-vuejs-accessibility';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'local-data/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  ...vue.configs['flat/recommended'],
  ...vueA11y.configs['flat/recommended'],
  unicorn.configs.recommended,
  regexp.configs['flat/recommended'],
  promise.configs['flat/recommended'],
  security.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.vue'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      complexity: ['error', 10],
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': ['error', { cases: { kebabCase: true, pascalCase: true } }],
      // Viele Fehlalarme bei typisierten Arrays und Indexzugriffen; TypeScript prüft die Typen bereits.
      'security/detect-object-injection': 'off',
      'vuejs-accessibility/label-has-for': ['error', { required: { some: ['nesting', 'id'] } }],
      'unicorn/no-null': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // Frühe Returns erzeugen unerreichbare Guard-Zweige, die die 99-%-Coverage unnötig belasten.
      'unicorn/prefer-early-return': 'off',
      // Rein stilistische Regeln, die bei Mathe-/Messcode eher stören.
      'unicorn/prefer-continue': 'off',
      'unicorn/prefer-ternary': 'off',
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/name-replacements': 'off',
      'unicorn/numeric-separators-style': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // Architekturregel: Farbmathe darf nichts aus der UI importieren.
    files: ['src/color/**/*.ts'],
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        { zones: [{ target: './src/color', from: './src/ui' }] },
      ],
    },
  },
  {
    ...vitest.configs.recommended,
    files: ['**/*.test.ts'],
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expectPoint'] }],
      // In Tests sind verschachtelte Aufrufe und lokale Hilfsfunktionen üblich.
      'unicorn/max-nested-calls': 'off',
      'unicorn/consistent-function-scoping': 'off',
    },
  },
  {
    ...playwright.configs['flat/recommended'],
    files: ['e2e/**/*.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Seitenobjekte und Szenarien sind bewusst ausführlich und tief verschachtelt.
      'unicorn/max-nested-calls': 'off',
      'unicorn/no-top-level-side-effects': 'off',
      'unicorn/prefer-module': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'import-x/no-unresolved': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/no-top-level-side-effects': 'off',
    },
  },
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },
  prettier,
);
