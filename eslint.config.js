import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';
import nPlugin from 'eslint-plugin-n';

export default [
  // Base recommended configuration
  js.configs.recommended,

  {
    // Global configuration for all JS files
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',

        // Chrome Extension APIs
        chrome: 'readonly',
        browser: 'readonly',

        // Web APIs
        customElements: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        CustomEvent: 'readonly',
        localStorage: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        Blob: 'readonly',
        getComputedStyle: 'readonly',

        // Node.js globals for build scripts
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly'
      }
    },

    plugins: {
      import: importPlugin,
      promise: promisePlugin,
      n: nPlugin
    },

    rules: {
      // === Code Quality Rules ===
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',
      'no-console': 'warn', // Allow console but warn
      'no-debugger': 'error',
      'no-alert': 'warn',

      // === Best Practices ===
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'no-async-promise-executor': 'error',

      // === Variables ===
      'no-undef': 'error',
      'no-global-assign': 'error',
      'no-implicit-globals': 'error',
      'no-redeclare': 'error',
      'no-shadow': ['error', { allow: ['err', 'error', 'event'] }],
      'no-use-before-define': ['error', { functions: false, classes: true }],

      // === Stylistic (Light Touch) ===
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'no-trailing-spaces': 'error',
      'comma-dangle': ['error', 'never'],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1, maxBOF: 0 }],
      'eol-last': ['error', 'always'],

      // === Import Plugin Rules ===
      'import/no-unresolved': 'off', // Too strict for our setup
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-unused-modules': 'off', // Can be slow

      // === Promise Plugin Rules ===
      'promise/always-return': 'warn',
      'promise/catch-or-return': 'error',
      'promise/param-names': 'error',
      'promise/no-return-wrap': 'error',
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',
      'promise/no-callback-in-promise': 'warn',
      'promise/avoid-new': 'off', // Sometimes needed

      // === Node.js Plugin Rules ===
      'n/no-unpublished-import': 'off',
      'n/no-missing-import': 'off', // Let bundler handle this
      'n/no-unsupported-features/es-syntax': 'off' // We target modern browsers
    }
  },


  {
    // CommonJS files
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'n/no-unpublished-require': 'off'
    }
  },

  {
    // Build scripts
    files: ['scripts/**/*.js', '*.config.js'],
    rules: {
      'no-console': 'off', // Build scripts can use console
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^(_|error)$',
        varsIgnorePattern: '^(_|error)$'
      }]
    }
  },

  {
    // Test files get Jest globals
    files: ['**/*.test.js'],
    languageOptions: {
      globals: {
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly'
      }
    },
    rules: {
      'no-unused-expressions': 'off', // For expect().toBe() etc
      'no-console': 'off',
      'promise/always-return': 'off',
      'require-await': 'off' // Test functions can be async without await
    }
  },

  {
    // Ignore common directories
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'packages/**', // Bundled/minified files
      '*.min.js',
      'build/**',
      '.git/**'
    ]
  }
];
