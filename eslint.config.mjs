import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
    js.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsparser,
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-var-requires': 'warn',
            '@typescript-eslint/no-unused-expressions': ['error', {
                allowShortCircuit: true,
                allowTernary: true,
                allowTaggedTemplates: true
            }],
            'no-unused-vars': 'off',
            'no-undef': 'off',
            'no-unused-expressions': 'off',
        },
    },
    {
        files: ['**/*.{js,mjs,cjs}'],
        rules: {
        },
    },
    {
        ignores: [
            'dist/**',
            'build/**',
            'node_modules/**',
            '*.config.{js,mjs,cjs}',
        ],
    },
];