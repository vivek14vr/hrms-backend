import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  { files: ['**/*.ts'], languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } } },
];
