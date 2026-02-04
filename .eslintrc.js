module.exports = {
  root: true,
  extends: ['@react-native'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
    semi: 'off',
    'no-extra-semi': 'off',
    '@typescript-eslint/no-extra-semi': 'off',
    '@typescript-eslint/func-call-spacing': 'off',
  },
}
