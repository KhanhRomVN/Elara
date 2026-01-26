import { createContext, useContext, useEffect, useState } from 'react';
import { PRESET_THEMES } from './theme-loader';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  applyPresetTheme: (preset: any) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  applyPresetTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(storageKey) as Theme;
    return stored || defaultTheme;
  });

  const applyCSSVariables = (preset: any) => {
    const root = window.document.documentElement;
    const cssVarMap: Record<string, string> = {
      primary: '--primary',
      background: '--background',
      textPrimary: '--text-primary',
      textSecondary: '--text-secondary',
      border: '--border',
      borderHover: '--border-hover',
      borderFocus: '--border-focus',
      divider: '--divider',
      cardBackground: '--card-background',
      inputBackground: '--input-background',
      inputBorderDefault: '--input-border-default',
      inputBorderHover: '--input-border-hover',
      inputBorderFocus: '--input-border-focus',
      dialogBackground: '--dialog-background',
      dropdownBackground: '--dropdown-background',
      dropdownItemHover: '--dropdown-item-hover',
      dropdownBorder: '--dropdown-border',
      dropdownBorderHover: '--dropdown-border-hover',
      sidebarBackground: '--sidebar-background',
      sidebarItemHover: '--sidebar-item-hover',
      sidebarItemFocus: '--sidebar-item-focus',
      buttonBg: '--button-bg',
      buttonBgHover: '--button-bg-hover',
      buttonText: '--button-text',
      buttonBorder: '--button-border',
      buttonBorderHover: '--button-border-hover',
      buttonSecondBg: '--button-second-bg',
      buttonSecondBgHover: '--button-second-bg-hover',
      bookmarkItemBg: '--bookmark-item-bg',
      bookmarkItemText: '--bookmark-item-text',
      drawerBackground: '--drawer-background',
      clockGradientFrom: '--clock-gradient-from',
      clockGradientTo: '--clock-gradient-to',
      cardShadow: '--card-shadow',
      dialogShadow: '--dialog-shadow',
      dropdownShadow: '--dropdown-shadow',
      // Table variables
      tableHeaderBg: '--table-header-bg',
      tableHoverHeaderBg: '--table-hover-header-bg',
      tableBodyBg: '--table-body-bg',
      tableHoverItemBodyBg: '--table-hover-item-body-bg',
      tableFocusItemBodyBg: '--table-focus-item-body-bg',
      tableFooterBg: '--table-footer-bg',
      tableHoverFooterBg: '--table-hover-footer-bg',
      tableBorder: '--table-border',
      // Tab variables
      tabBackground: '--tab-background',
      tabBorder: '--tab-border',
      tabHoverBorder: '--tab-hover-border',
      // TabItem variables
      tabItemBackground: '--tab-item-background',
      tabItemHoverBg: '--tab-item-hover-bg',
      tabItemFocusBg: '--tab-item-focus-bg',
      tabItemBorder: '--tab-item-border',
      tabItemHoverBorder: '--tab-item-hover-border',
      tabItemFocusBorder: '--tab-item-focus-border',
    };
    // Use tailwind property from new theme structure
    const themeData = preset.tailwind || preset;
    Object.entries(themeData).forEach(([key, value]) => {
      const cssVar = cssVarMap[key];
      if (cssVar && value) {
        root.style.setProperty(cssVar, value as string);
      }
    });
  };

  const applyPresetTheme = (preset: any) => {
    // Find the latest preset from PRESET_THEMES if name matches
    let latestPreset = preset;
    if (preset.name) {
      const allPresets = [...PRESET_THEMES.light, ...PRESET_THEMES.dark];
      const foundPreset = allPresets.find((p) => p.name === preset.name);
      if (foundPreset) {
        latestPreset = foundPreset;
      }
    }

    applyCSSVariables(latestPreset);
    // Save preset with name for CodeBlock theme detection
    const presetWithName = {
      ...latestPreset,
      name: latestPreset.name, // Ensure name is saved
    };
    localStorage.setItem(`${storageKey}-preset`, JSON.stringify(presetWithName));

    // Dispatch custom event to notify CodeBlock components
    window.dispatchEvent(
      new CustomEvent('theme-preset-changed', {
        detail: { presetName: latestPreset.name },
      }),
    );
  };

  // Load saved preset theme on mount
  useEffect(() => {
    const savedPreset = localStorage.getItem(`${storageKey}-preset`);
    if (savedPreset) {
      try {
        const preset = JSON.parse(savedPreset);
        applyCSSVariables(preset);
      } catch (e) {
        console.error('Failed to load saved preset theme', e);
      }
    } else {
      // Apply Default Dark theme on first load
      const defaultDarkPreset = PRESET_THEMES.dark[0];
      applyCSSVariables(defaultDarkPreset);
      localStorage.setItem(`${storageKey}-preset`, JSON.stringify(defaultDarkPreset));
    }
  }, []);

  // Auto-sync preset with latest changes in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const syncInterval = setInterval(() => {
      const savedPreset = localStorage.getItem(`${storageKey}-preset`);
      if (savedPreset) {
        try {
          const preset = JSON.parse(savedPreset);
          if (preset.name) {
            const allPresets = [...PRESET_THEMES.light, ...PRESET_THEMES.dark];
            const latestPreset = allPresets.find((p) => p.name === preset.name);
            if (latestPreset) {
              // Compare if colors have changed
              const hasChanges =
                JSON.stringify(latestPreset.tailwind) !== JSON.stringify(preset.tailwind) ||
                JSON.stringify(latestPreset.monaco) !== JSON.stringify(preset.monaco);

              if (hasChanges) {
                console.log(`[Theme Sync] Updating preset: ${preset.name}`);
                applyPresetTheme(latestPreset);
              }
            }
          }
        } catch (e) {
          console.error('Failed to sync preset theme', e);
        }
      }
    }, 2000); // Check every 2 seconds in development

    return () => clearInterval(syncInterval);
  }, [storageKey, applyPresetTheme]);

  // Watch for changes in theme presets during development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const checkPresetUpdate = () => {
      const savedPreset = localStorage.getItem(`${storageKey}-preset`);
      if (savedPreset) {
        try {
          const preset = JSON.parse(savedPreset);
          applyCSSVariables(preset);
        } catch (e) {
          console.error('Failed to reload preset theme', e);
        }
      }
    };

    // Listen for custom event from HMR or manual refresh
    window.addEventListener('theme-preset-reload', checkPresetUpdate);

    return () => {
      window.removeEventListener('theme-preset-reload', checkPresetUpdate);
    };
  }, [storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    applyPresetTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
