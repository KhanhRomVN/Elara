import { createContext, useContext, useEffect, useState } from 'react';
import { PRESET_THEMES, ThemeConfig } from './theme-loader';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  applyPresetTheme: (preset: ThemeConfig) => void;
  currentPreset: ThemeConfig | null;
};

const initialState: ThemeProviderState = {
  theme: 'dark',
  setTheme: () => null,
  applyPresetTheme: () => null,
  currentPreset: null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
  });
  const [currentPreset, setCurrentPreset] = useState<ThemeConfig | null>(null);

  const applyCSSVariables = (preset: ThemeConfig) => {
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
      tableHeaderBg: '--table-header-bg',
      tableHoverHeaderBg: '--table-hover-header-bg',
      tableBodyBg: '--table-body-bg',
      tableHoverItemBodyBg: '--table-hover-item-body-bg',
      tableFocusItemBodyBg: '--table-focus-item-body-bg',
      tableFooterBg: '--table-footer-bg',
      tableHoverFooterBg: '--table-hover-footer-bg',
      tableBorder: '--table-border',
      tabBackground: '--tab-background',
      tabBorder: '--tab-border',
      tabHoverBorder: '--tab-hover-border',
      tabItemBackground: '--tab-item-background',
      tabItemHoverBg: '--tab-item-hover-bg',
      tabItemFocusBg: '--tab-item-focus-bg',
      tabItemBorder: '--tab-item-border',
      tabItemHoverBorder: '--tab-item-hover-border',
      tabItemFocusBorder: '--tab-item-focus-border',
    };

    const themeData = preset.tailwind;
    Object.entries(themeData).forEach(([key, value]) => {
      const cssVar = cssVarMap[key];
      if (cssVar && value) {
        root.style.setProperty(cssVar, value as string);
      }
    });
  };

  const applyPresetTheme = (preset: ThemeConfig) => {
    applyCSSVariables(preset);
    setCurrentPreset(preset);
    // Save preset name without "Light" or "Dark" suffix to maintain consistency across modes
    const baseName = preset.name.replace(/Light$|Dark$/, '');
    localStorage.setItem(`${storageKey}-preset-name`, baseName);
  };

  const loadPresetForMode = (mode: 'light' | 'dark') => {
    const savedPresetName = localStorage.getItem(`${storageKey}-preset-name`);
    if (savedPresetName) {
      // Try to find the preset for the current mode
      const targetName = `${savedPresetName}${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
      const preset = PRESET_THEMES[mode].find((p) => p.name === targetName);
      if (preset) {
        applyCSSVariables(preset);
        setCurrentPreset(preset);
        return;
      }
    }
    // Fallback if no specific preset saved or found
    const defaultPreset = PRESET_THEMES[mode][0];
    applyCSSVariables(defaultPreset);
    setCurrentPreset(defaultPreset);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let effectiveMode: 'light' | 'dark' = 'dark'; // Default

    if (theme === 'system') {
      effectiveMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      effectiveMode = theme;
    }

    root.classList.add(effectiveMode);
    loadPresetForMode(effectiveMode);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    applyPresetTheme,
    currentPreset,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
