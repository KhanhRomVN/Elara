import { ThemePreset } from '../types/theme.types';

export const loadTheme = (preset: ThemePreset, mode: 'light' | 'dark') => {
  return preset.modes[mode];
};
