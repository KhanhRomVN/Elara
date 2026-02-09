/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/**/*.{ts,tsx}'],
  safelist: [
    'bg-card-background',
    'bg-input-background',
    'bg-dialog-background',
    'bg-dropdown-background',
    'bg-sidebar-background',
    'bg-drawer-background',
    // Table safelist
    'bg-table-headerBg',
    'hover:bg-table-hoverHeaderBg',
    'bg-table-bodyBg',
    'hover:bg-table-hoverItemBodyBg',
    'focus:bg-table-focusItemBodyBg',
    'bg-table-footerBg',
    'hover:bg-table-hoverFooterBg',
    'border-table-border',
    // Tab safelist
    'bg-tab-background',
    'border-tab-border',
    'hover:border-tab-hoverBorder',
    // TabItem safelist
    'bg-tab-item-background',
    'hover:bg-tab-item-hoverBg',
    'focus:bg-tab-item-focusBg',
    'border-tab-item-border',
    'hover:border-tab-item-hoverBorder',
    'focus:border-tab-item-focusBorder',
  ],
  theme: {
    extend: {
      colors: {
        // Universal aliases for compatibility (Shadcn/Legacy CSS)
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          hover: 'rgb(var(--border-hover) / <alpha-value>)',
          focus: 'rgb(var(--border-focus) / <alpha-value>)',
        },
        input: {
          DEFAULT: 'rgb(var(--input-background) / <alpha-value>)',
          background: 'rgb(var(--input-background) / <alpha-value>)',
          border: {
            DEFAULT: 'rgb(var(--input-border-default) / <alpha-value>)',
            hover: 'rgb(var(--input-border-hover) / <alpha-value>)',
            focus: 'rgb(var(--input-border-focus) / <alpha-value>)',
          },
        },
        ring: 'rgb(var(--primary) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--text-primary) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--button-text) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--button-second-bg) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--text-secondary) / <alpha-value>)',
          foreground: 'rgb(var(--text-secondary) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--sidebar-item-hover) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--dropdown-background) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--card-background) / <alpha-value>)',
          background: 'rgb(var(--card-background) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary) / <alpha-value>)',
        },

        // New structured tokens
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        },
        divider: 'rgb(var(--divider) / <alpha-value>)',
        dialog: {
          background: 'rgb(var(--dialog-background) / <alpha-value>)',
        },
        dropdown: {
          background: 'rgb(var(--dropdown-background) / <alpha-value>)',
          border: 'rgb(var(--dropdown-border) / <alpha-value>)',
          itemHover: 'rgb(var(--dropdown-item-hover) / <alpha-value>)',
          borderHover: 'rgb(var(--dropdown-border-hover) / <alpha-value>)',
        },
        sidebar: {
          background: 'rgb(var(--sidebar-background) / <alpha-value>)',
          itemHover: 'rgb(var(--sidebar-item-hover) / <alpha-value>)',
          itemFocus: 'rgb(var(--sidebar-item-focus) / <alpha-value>)',
        },
        button: {
          bg: 'rgb(var(--button-bg) / <alpha-value>)',
          bgHover: 'rgb(var(--button-bg-hover) / <alpha-value>)',
          bgText: 'rgb(var(--button-text) / <alpha-value>)',
          border: 'rgb(var(--button-border) / <alpha-value>)',
          borderHover: 'rgb(var(--button-border-hover) / <alpha-value>)',
          secondBg: 'rgb(var(--button-second-bg) / <alpha-value>)',
          secondBgHover: 'rgb(var(--button-second-bg-hover) / <alpha-value>)',
        },
        drawer: {
          background: 'rgb(var(--drawer-background) / <alpha-value>)',
        },
        // Table colors
        table: {
          headerBg: 'rgb(var(--table-header-bg) / <alpha-value>)',
          hoverHeaderBg: 'rgb(var(--table-hover-header-bg) / <alpha-value>)',
          bodyBg: 'rgb(var(--table-body-bg) / <alpha-value>)',
          hoverItemBodyBg: 'rgb(var(--table-hover-item-body-bg) / <alpha-value>)',
          focusItemBodyBg: 'rgb(var(--table-focus-item-body-bg) / <alpha-value>)',
          footerBg: 'rgb(var(--table-footer-bg) / <alpha-value>)',
          hoverFooterBg: 'rgb(var(--table-hover-footer-bg) / <alpha-value>)',
          border: 'rgb(var(--table-border) / <alpha-value>)',
        },
        // Tab colors
        tab: {
          background: 'rgb(var(--tab-background) / <alpha-value>)',
          border: 'rgb(var(--tab-border) / <alpha-value>)',
          hoverBorder: 'rgb(var(--tab-hover-border) / <alpha-value>)',
        },
        // TabItem colors
        'tab-item': {
          background: 'rgb(var(--tab-item-background) / <alpha-value>)',
          hoverBg: 'rgb(var(--tab-item-hover-bg) / <alpha-value>)',
          focusBg: 'rgb(var(--tab-item-focus-bg) / <alpha-value>)',
          border: 'rgb(var(--tab-item-border) / <alpha-value>)',
          hoverBorder: 'rgb(var(--tab-item-hover-border) / <alpha-value>)',
          focusBorder: 'rgb(var(--tab-item-focus-border) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
