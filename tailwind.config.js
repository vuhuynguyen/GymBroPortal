/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  safelist: [
    // Responsive layout classes used in inline component templates (.ts files).
    // Tailwind JIT can miss these when scanning .ts template strings.
    'lg:grid-cols-3',
    'lg:col-span-1',
    'lg:col-span-2',
    'lg:gap-8',
    'lg:sticky',
    'lg:top-8',
    'lg:self-start',
    'lg:px-8',
    'sm:px-6',
    'md:left-[var(--inv-app-sidebar-width)]',
    'md:min-h-[calc(100dvh-6.5rem)]',
    'md:pb-[5.5rem]',
    { pattern: /min-\[480px\]:.*/ },
    { pattern: /min-\[560px\]:.*/ },
  ],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--inv-font-sans)', 'system-ui', 'sans-serif']
      },
      fontSize: {
        'inv-h1': ['var(--inv-text-h1)', { lineHeight: '1.2', fontWeight: '600' }],
        'inv-h2': ['var(--inv-text-h2)', { lineHeight: '1.2', fontWeight: '600' }],
        'inv-h3': ['var(--inv-text-h3)', { lineHeight: '1.25', fontWeight: '600' }],
        'inv-h4': ['var(--inv-text-h4)', { lineHeight: '1.3', fontWeight: '600' }],
        'inv-h5': ['var(--inv-text-h5)', { lineHeight: '1.35', fontWeight: '600' }],
        'inv-h6': ['var(--inv-text-h6)', { lineHeight: '1.4', fontWeight: '600' }],
        'inv-body-lg': ['var(--inv-text-body-lg)', { lineHeight: '1.5' }],
        'inv-body-md': ['var(--inv-text-body-md)', { lineHeight: '1.5' }],
        'inv-body-sm': ['var(--inv-text-body-sm)', { lineHeight: '1.5' }],
        'inv-body-mini': ['var(--inv-text-body-mini)', { lineHeight: '1.45' }]
      },
      borderRadius: {
        'inv-sm': 'var(--inv-radius-sm)',
        'inv-md': 'var(--inv-radius-md)',
        'inv-lg': 'var(--inv-radius-lg)'
      },
      boxShadow: {
        'inv-card': 'var(--inv-shadow-card)'
      },
      spacing: {
        'inv-1': 'var(--inv-space-1)',
        'inv-2': 'var(--inv-space-2)',
        'inv-3': 'var(--inv-space-3)',
        'inv-4': 'var(--inv-space-4)',
        'inv-5': 'var(--inv-space-5)',
        'inv-6': 'var(--inv-space-6)'
      },
      colors: {
        /* Figma Edit Exercise — `App.tsx`: card vs field borders (see `src/styles.scss` :root). */
        'inv-border-card': 'var(--inv-border-card)',
        'inv-border-field': 'var(--inv-border-field)',
        inv: {
          primary: {
            0: 'var(--inv-primary-0)',
            25: 'var(--inv-primary-25)',
            50: 'var(--inv-primary-50)',
            100: 'var(--inv-primary-100)',
            200: 'var(--inv-primary-200)',
            300: 'var(--inv-primary-300)',
            400: 'var(--inv-primary-400)',
            500: 'var(--inv-primary-500)',
            600: 'var(--inv-primary-600)',
            700: 'var(--inv-primary-700)',
            800: 'var(--inv-primary-800)',
            900: 'var(--inv-primary-900)'
          },
          surface: {
            base: 'var(--inv-surface-base)'
          },
          secondary: {
            0: 'var(--inv-secondary-0)',
            25: 'var(--inv-secondary-25)',
            50: 'var(--inv-secondary-50)',
            100: 'var(--inv-secondary-100)',
            200: 'var(--inv-secondary-200)',
            300: 'var(--inv-secondary-300)'
          },
          grey: {
            0: 'var(--inv-grey-0)',
            25: 'var(--inv-grey-25)',
            50: 'var(--inv-grey-50)',
            100: 'var(--inv-grey-100)',
            200: 'var(--inv-grey-200)',
            300: 'var(--inv-grey-300)',
            400: 'var(--inv-grey-400)',
            500: 'var(--inv-grey-500)',
            600: 'var(--inv-grey-600)',
            700: 'var(--inv-grey-700)',
            800: 'var(--inv-grey-800)',
            900: 'var(--inv-grey-900)'
          },
          sky: {
            0: 'var(--inv-sky-0)',
            25: 'var(--inv-sky-25)',
            50: 'var(--inv-sky-50)',
            100: 'var(--inv-sky-100)',
            200: 'var(--inv-sky-200)',
            300: 'var(--inv-sky-300)'
          },
          success: {
            0: 'var(--inv-success-0)',
            25: 'var(--inv-success-25)',
            50: 'var(--inv-success-50)',
            100: 'var(--inv-success-100)',
            200: 'var(--inv-success-200)',
            300: 'var(--inv-success-300)'
          },
          warning: {
            0: 'var(--inv-warning-0)',
            25: 'var(--inv-warning-25)',
            50: 'var(--inv-warning-50)',
            100: 'var(--inv-warning-100)',
            200: 'var(--inv-warning-200)',
            300: 'var(--inv-warning-300)'
          },
          error: {
            0: 'var(--inv-error-0)',
            25: 'var(--inv-error-25)',
            50: 'var(--inv-error-50)',
            100: 'var(--inv-error-100)',
            200: 'var(--inv-error-200)',
            300: 'var(--inv-error-300)'
          }
        }
      }
    }
  },
  plugins: []
};
