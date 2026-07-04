/* Shared Tailwind (Play CDN) configuration for every TrendyinUS page.
   Loaded immediately after the Tailwind CDN script. Colours resolve to the
   CSS variables defined in theme.css, so the same markup renders correctly
   in both light and dark mode. */
(function () {
  function c(name) { return 'rgb(var(--' + name + ') / <alpha-value>)'; }
  var colors = {};
  [
    'background', 'on-background', 'surface', 'surface-bright', 'surface-dim',
    'surface-variant', 'surface-container', 'surface-container-low',
    'surface-container-lowest', 'surface-container-high', 'surface-container-highest',
    'on-surface', 'on-surface-variant', 'primary', 'on-primary', 'primary-container',
    'on-primary-container', 'primary-fixed', 'primary-fixed-dim', 'secondary',
    'secondary-container', 'on-secondary', 'on-secondary-container', 'tertiary',
    'on-tertiary', 'outline', 'outline-variant', 'error', 'on-error',
    'error-container', 'on-error-container', 'inverse-surface', 'inverse-on-surface',
    'inverse-primary', 'surface-tint', 'card'
  ].forEach(function (n) { colors[n] = c(n); });

  window.tailwind = window.tailwind || {};
  window.tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        colors: colors,
        borderRadius: { DEFAULT: '0.125rem', lg: '0.25rem', xl: '0.5rem', full: '0.75rem' },
        spacing: {
          'container-max': '1536px', 'stack-md': '16px', 'gutter': '24px',
          'stack-sm': '8px', 'stack-lg': '32px', 'margin-mobile': '16px', 'margin-desktop': '48px'
        },
        fontFamily: {
          'body-lg': ['"Source Serif 4"', 'serif'], 'body-md': ['"Source Serif 4"', 'serif'],
          'label-sm': ['Inter', 'sans-serif'], 'headline-md': ['"Archivo Narrow"', 'sans-serif'],
          'headline-lg': ['"Archivo Narrow"', 'sans-serif'], 'headline-xl': ['"Archivo Narrow"', 'sans-serif'],
          'headline-lg-mobile': ['"Archivo Narrow"', 'sans-serif']
        },
        fontSize: {
          'body-lg': ['20px', { lineHeight: '1.6', fontWeight: '400' }],
          'body-md': ['17px', { lineHeight: '1.6', fontWeight: '400' }],
          'label-sm': ['12px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '600' }],
          'headline-md': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
          'headline-lg': ['40px', { lineHeight: '1.2', fontWeight: '700' }],
          'headline-lg-mobile': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
          'headline-xl': ['64px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }]
        }
      }
    }
  };
})();
