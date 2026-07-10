'use strict';

const nodeGlobals = {
  AbortController: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  exports: 'readonly',
  fetch: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setImmediate: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly'
};

const jestGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  jest: 'readonly',
  test: 'readonly'
};

module.exports = [
  {
    ignores: ['coverage/**', 'node_modules/**']
  },
  {
    files: ['index.js', 'lib/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: nodeGlobals,
      sourceType: 'commonjs'
    },
    rules: {
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: jestGlobals
    }
  }
];
