import React, { createContext, useEffect, useState } from 'react';
import { ThemePreset, ThemeMode } from './types/theme.types';
import { defaultTheme } from './presets/default';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  currentPreset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  currentPreset: defaultTheme,
  setPreset: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme: _defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>(
    () => (localStorage.getItem(storageKey) as ThemeMode) || _defaultTheme,
  );
  const [currentPreset, setPreset] = useState<ThemePreset>(defaultTheme);

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
    setTheme: (theme: ThemeMode) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    currentPreset,
    setPreset,
  };

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export { ThemeProviderContext };
