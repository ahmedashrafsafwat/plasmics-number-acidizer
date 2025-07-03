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
            // Fixed TypeScript rules
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-var-requires': 'warn',

            // Properly configure no-unused-expressions if needed
            '@typescript-eslint/no-unused-expressions': ['error', {
                allowShortCircuit: true,
                allowTernary: true,
                allowTaggedTemplates: true
            }],

            // Turn off conflicting base ESLint rules
            'no-unused-vars': 'off',
            'no-undef': 'off',
            'no-unused-expressions': 'off', // Use TypeScript version instead
        },
    },
    {
        files: ['**/*.{js,mjs,cjs}'],
        rules: {
            // JavaScript-only rules
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