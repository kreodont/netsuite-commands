module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  env: {
    node: true,
    es2021: true,
    browser: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // TypeScript rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],

    // JavaScript rules
    'no-unused-vars': ['warn', {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-constant-condition': ['error', { 'checkLoops': false }],

    // NetSuite specific
    '@typescript-eslint/no-namespace': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '**/src/**',
    '**/__tests__/**/*.js',
    'jest.config.js',
    'build.js',
    'create-project.js',
    'upload-files.js'
  ],
};