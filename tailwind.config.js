/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input-background)',
        ring: 'var(--primary)',
        background: 'var(--background)',
        foreground: 'var(--text-primary)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--button-text)',
        },
        secondary: {
          DEFAULT: 'var(--button-second-bg)',
          foreground: 'var(--text-primary)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'var(--text-secondary)',
          foreground: 'var(--text-secondary)',
        },
        accent: {
          DEFAULT: 'var(--sidebar-item-hover)',
          foreground: 'var(--text-primary)',
        },
        popover: {
          DEFAULT: 'var(--dropdown-background)',
          foreground: 'var(--text-primary)',
        },
        card: {
          DEFAULT: 'var(--card-background)',
          foreground: 'var(--text-primary)',
        },
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'border-hover': 'var(--border-hover)',
        'border-focus': 'var(--border-focus)',
        'sidebar-bg': 'var(--sidebar-background)',
        'sidebar-hover': 'var(--sidebar-item-hover)',
        'sidebar-focus': 'var(--sidebar-item-focus)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
