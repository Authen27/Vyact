import type { Config } from 'tailwindcss';

// Claude native theme — paper-warm with brand orange
// Inspired by claude.ai's interface aesthetic
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces — warm off-white papers
        bg:        'hsl(var(--bg))',
        surface:   'hsl(var(--surface))',
        elev:      'hsl(var(--elev))',
        sunken:    'hsl(var(--sunken))',
        // Text
        ink:       'hsl(var(--ink))',
        'ink-mid': 'hsl(var(--ink-mid))',
        'ink-dim': 'hsl(var(--ink-dim))',
        // Brand
        claude:    'hsl(var(--claude))',     // primary terracotta
        'claude-2':'hsl(var(--claude-2))',   // hover/active
        tan:       'hsl(var(--tan))',
        // Semantic
        positive:  'hsl(var(--positive))',
        warn:      'hsl(var(--warn))',
        danger:    'hsl(var(--danger))',
        info:      'hsl(var(--info))',
        // Lines
        line:      'hsl(var(--line))',
        line2:     'hsl(var(--line2))',
      },
      fontFamily: {
        // Tiempos-like serif for headings (Claude uses Tiempos, Source Serif Pro is open-source equivalent)
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        // Styrene-like sans for UI (Inter is the open-source nearest-neighbour)
        ui:      ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '4px', md: '6px', lg: '10px', pill: '999px',
      },
      boxShadow: {
        '1': '0 1px 3px hsl(var(--shadow) / 0.04)',
        '2': '0 4px 12px hsl(var(--shadow) / 0.06)',
        '3': '0 12px 32px hsl(var(--shadow) / 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
