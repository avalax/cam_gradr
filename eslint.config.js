import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import promise from 'eslint-plugin-promise';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import unicorn from 'eslint-plugin-unicorn';
import vue from 'eslint-plugin-vue';
import vueA11y from 'eslint-plugin-vuejs-accessibility';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'local-data/**'] },
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
      'unicorn/filename-case': [
        'error',
        { case: 'kebabCase', ignore: [/^App\.vue$/, /^App\.test\.ts$/] },
      ],
      'unicorn/no-null': 'off',
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
  { ...vitest.configs.recommended, files: ['**/*.test.ts'] },
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
