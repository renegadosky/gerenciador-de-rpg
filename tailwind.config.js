/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // escala de cinzas do tema atual: 950 = mais fundo ... 100 = texto. Os valores vêm de src/index.css (um bloco por tema).
        g: Object.fromEntries([950, 900, 850, 800, 750, 700, 600, 500, 400, 300, 200, 100].map((n) => [n, v(`g-${n}`)])),
        accent: { DEFAULT: v('accent'), strong: v('accent-strong'), soft: 'rgb(var(--accent) / 0.16)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Inter', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: { '2xs': ['10.5px', '14px'], xs: ['11.5px', '16px'], sm: ['12.5px', '18px'] },
    },
  },
  plugins: [],
};
