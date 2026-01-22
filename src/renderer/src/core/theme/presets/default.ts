import defaultLight from './DefaultLight.json';
import defaultDark from './DefaultDark.json';
import { ThemePreset } from '../types/theme.types';

export const defaultTheme: ThemePreset = {
  name: 'Default',
  modes: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    light: defaultLight as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dark: defaultDark as any,
  },
};
