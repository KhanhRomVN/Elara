// Light Themes
import DefaultLight from './themes/DefaultLight.json';
import IndigoLight from './themes/IndigoLight.json';
import OceanLight from './themes/OceanLight.json';
import ForestLight from './themes/ForestLight.json';
import SunsetLight from './themes/SunsetLight.json';
import LavenderLight from './themes/LavenderLight.json';
import RoseLight from './themes/RoseLight.json';
import AmberLight from './themes/AmberLight.json';
import SkyLight from './themes/SkyLight.json';
import EmeraldLight from './themes/EmeraldLight.json';
import FuchsiaLight from './themes/FuchsiaLight.json';
import SlateLight from './themes/SlateLight.json';
import TealLight from './themes/TealLight.json';

// Dark Themes
import DefaultDark from './themes/DefaultDark.json';
import MidnightDark from './themes/MidnightDark.json';
import OceanDark from './themes/OceanDark.json';
import ForestDark from './themes/ForestDark.json';
import SunsetDark from './themes/SunsetDark.json';
import LavenderDark from './themes/LavenderDark.json';
import RoseDark from './themes/RoseDark.json';
import AmberDark from './themes/AmberDark.json';
import SkyDark from './themes/SkyDark.json';
import EmeraldDark from './themes/EmeraldDark.json';
import FuchsiaDark from './themes/FuchsiaDark.json';
import SlateDark from './themes/SlateDark.json';
import TealDark from './themes/TealDark.json';

export interface ThemeConfig {
  name: string;
  monaco: {
    base: string;
    inherit: boolean;
    rules: Array<{
      foreground?: string;
      background?: string;
      fontStyle?: string;
      token: string;
    }>;
    colors: {
      [key: string]: string;
    };
  };
  tailwind: {
    primary: string;
    background: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    borderHover: string;
    borderFocus: string;
    cardBackground: string;
    inputBackground: string;
    inputBorderDefault: string;
    inputBorderHover: string;
    inputBorderFocus: string;
    dialogBackground: string;
    dropdownBackground: string;
    dropdownItemHover: string;
    dropdownBorder: string;
    dropdownBorderHover: string;
    sidebarBackground: string;
    sidebarItemHover: string;
    sidebarItemFocus: string;
    buttonBg: string;
    buttonBgHover: string;
    buttonText: string;
    buttonBorder: string;
    buttonBorderHover: string;
    buttonSecondBg: string;
    buttonSecondBgHover: string;
    bookmarkItemBg: string;
    bookmarkItemText: string;
    drawerBackground: string;
    clockGradientFrom: string;
    clockGradientTo: string;
    cardShadow: string;
    dialogShadow: string;
    dropdownShadow: string;
    tableHeaderBg: string;
    tableBodyBg: string;
    tableHoverItemBodyBg: string;
    tableFocusItemBodyBg: string;
    tableFooterBg: string;
    tableBorder: string;
    tabBackground: string;
    tabBorder: string;
    tabHoverBorder: string;
    tabItemBackground: string;
    tabItemHoverBg: string;
    tabItemFocusBg: string;
    tabItemBorder: string;
    tabItemHoverBorder: string;
    tabItemFocusBorder: string;
  };
}

// Type assertion to ensure JSON files match ThemeConfig
const themes = {
  // Light Themes
  DefaultLight: DefaultLight as ThemeConfig,
  IndigoLight: IndigoLight as ThemeConfig,
  OceanLight: OceanLight as ThemeConfig,
  ForestLight: ForestLight as ThemeConfig,
  SunsetLight: SunsetLight as ThemeConfig,
  LavenderLight: LavenderLight as ThemeConfig,
  RoseLight: RoseLight as ThemeConfig,
  AmberLight: AmberLight as ThemeConfig,
  SkyLight: SkyLight as ThemeConfig,
  EmeraldLight: EmeraldLight as ThemeConfig,
  FuchsiaLight: FuchsiaLight as ThemeConfig,
  SlateLight: SlateLight as ThemeConfig,
  TealLight: TealLight as ThemeConfig,

  // Dark Themes
  DefaultDark: DefaultDark as ThemeConfig,
  MidnightDark: MidnightDark as ThemeConfig,
  OceanDark: OceanDark as ThemeConfig,
  ForestDark: ForestDark as ThemeConfig,
  SunsetDark: SunsetDark as ThemeConfig,
  LavenderDark: LavenderDark as ThemeConfig,
  RoseDark: RoseDark as ThemeConfig,
  AmberDark: AmberDark as ThemeConfig,
  SkyDark: SkyDark as ThemeConfig,
  EmeraldDark: EmeraldDark as ThemeConfig,
  FuchsiaDark: FuchsiaDark as ThemeConfig,
  SlateDark: SlateDark as ThemeConfig,
  TealDark: TealDark as ThemeConfig,
};

export const PRESET_THEMES: Record<'light' | 'dark', ThemeConfig[]> = {
  light: [
    themes.DefaultLight,
    themes.IndigoLight,
    themes.OceanLight,
    themes.ForestLight,
    themes.SunsetLight,
    themes.LavenderLight,
    themes.RoseLight,
    themes.AmberLight,
    themes.SkyLight,
    themes.EmeraldLight,
    themes.FuchsiaLight,
    themes.SlateLight,
    themes.TealLight,
  ],
  dark: [
    themes.DefaultDark,
    themes.MidnightDark,
    themes.OceanDark,
    themes.ForestDark,
    themes.SunsetDark,
    themes.LavenderDark,
    themes.RoseDark,
    themes.AmberDark,
    themes.SkyDark,
    themes.EmeraldDark,
    themes.FuchsiaDark,
    themes.SlateDark,
    themes.TealDark,
  ],
};

export type PresetThemeType = ThemeConfig;
