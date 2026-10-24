const js = require('@eslint/js');
const globals = require('globals');
const typescript = require('@typescript-eslint/eslint-plugin');
const jest = require('eslint-plugin-jest');
const prettier = require('eslint-plugin-prettier/recommended');

module.exports = [
  { ignores: ['coverage/**', 'lib/**', 'Shared/**'] },
  js.configs.recommended,
  ...typescript.configs['flat/recommended'].map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      complexity: ['warn', 10],
      'max-lines': [
        'warn',
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      'max-params': ['warn', 5],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    rules: { '@typescript-eslint/ban-ts-comment': 'warn' },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
    },
    rules: { '@typescript-eslint/no-unnecessary-condition': 'warn' },
  },
  {
    files: ['test/**/*.ts'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      ...jest.configs['flat/style'].rules,
    },
  },
  prettier,
];
