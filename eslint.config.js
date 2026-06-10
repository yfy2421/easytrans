import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Base
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Vue files
  ...vuePlugin.configs['flat/recommended'],
  {
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  // WXT globals + browser API
  {
    files: ['src/**/*.ts', 'src/**/*.vue'],
    languageOptions: {
      globals: {
        browser: 'readonly',
        chrome: 'readonly',
        defineContentScript: 'readonly',
        defineBackground: 'readonly',
      },
    },
  },

  // TypeScript files
  {
    files: ['*.ts', '**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Global ignores
  {
    ignores: [
      '.output/',
      '.wxt/',
      'dist/',
      'node_modules/',
      'coverage/',
      'eslint.config.js',
    ],
  },

  // Prettier must be last to override formatting rules
  prettierConfig,
);
