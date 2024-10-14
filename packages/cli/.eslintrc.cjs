/* eslint-env node */
module.exports = {
  root: true,
  parserOptions: {
    sourceType: 'module',
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier', 'jest', 'unused-imports'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    'no-console': 1,
    'prettier/prettier': 2,
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
  },
  env: {
    node: true,
    'jest/globals': true,
  },
}
