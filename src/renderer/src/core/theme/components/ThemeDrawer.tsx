import React from 'react';
import { useTheme } from '../ThemeProvider';
import { PRESET_THEMES } from '../theme-loader';
import { Drawer } from '../../../shared/components/ui/drawer';
import { X, Palette } from 'lucide-react';

interface ThemeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ThemeDrawer: React.FC<ThemeDrawerProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, applyPresetTheme } = useTheme();

  // Icons for theme modes
  const LightIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );

  const DarkIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );

  // Theme mode buttons
  const renderThemeSelector = () => (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4 text-text-primary">Theme Mode</h3>
      <div className="grid grid-cols-2 gap-3">
        {['light', 'dark'].map((mode) => {
          const Icon = mode === 'light' ? LightIcon : DarkIcon;
          return (
            <button
              key={mode}
              onClick={() => setTheme(mode as any)}
              className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 ${
                theme === mode
                  ? 'bg-primary/10 text-primary shadow-sm border border-primary/20'
                  : 'bg-card-background hover:bg-card-background/80 text-text-secondary border border-border'
              } hover:scale-[1.02] active:scale-[0.98]`}
            >
              <div
                className={`mb-2 p-2 rounded-full transition-colors ${
                  theme === mode ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon />
              </div>
              <span className="font-medium capitalize text-sm">{mode}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Preset color swatches
  const renderPresetThemes = (t: 'light' | 'dark') => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-text-primary">Preset Themes</h3>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {PRESET_THEMES[t].map((preset, idx) => {
          return (
            <button
              key={idx}
              onClick={() => applyPresetTheme(preset)}
              className="relative flex flex-col p-3 rounded-xl transition-all overflow-hidden bg-background border border-border hover:border-primary/50 hover:scale-[1.02] duration-200 group"
            >
              <div className="w-full h-24 rounded-lg overflow-hidden mb-3 relative border border-border">
                <div className="h-3 w-full" style={{ backgroundColor: preset.tailwind.primary }} />
                <div className="flex h-21">
                  <div
                    className="w-1/4 h-full border-r border-border"
                    style={{
                      backgroundColor:
                        preset.tailwind.sidebarBackground || preset.tailwind.cardBackground,
                    }}
                  />
                  <div
                    className="w-3/4 h-full p-2"
                    style={{ backgroundColor: preset.tailwind.background }}
                  >
                    <div
                      className="w-full h-3 rounded mb-1"
                      style={{
                        backgroundColor: preset.tailwind.cardBackground,
                      }}
                    />
                    <div
                      className="w-3/4 h-3 rounded"
                      style={{
                        backgroundColor: preset.tailwind.cardBackground,
                      }}
                    />
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-background/90 p-1.5 rounded-full shadow-sm border border-border">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: preset.tailwind.primary }}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center w-full px-1">
                <div className="text-left">
                  <span className="font-semibold text-sm block text-text-primary">
                    {preset.name}
                  </span>
                  <span className="text-xs text-text-secondary">Custom palette</span>
                </div>
              </div>
              <div className="flex mt-3 gap-1.5 w-full px-1">
                {['primary', 'background', 'cardBackground', 'textPrimary', 'border'].map((k) => (
                  <div
                    key={k}
                    className="h-1.5 flex-1 rounded-full shadow-sm"
                    style={{
                      backgroundColor: (preset.tailwind as any)[k] || '#000',
                    }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      width="400px"
      direction="right"
      animationType="elastic"
    >
      <div className="flex items-center justify-between p-5 border-b border-border bg-card-background">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Theme Settings</h2>
          <p className="text-sm text-text-secondary">Customize the look and feel</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
          <X className="h-5 w-5 text-text-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 bg-card-background custom-scrollbar">
        {renderThemeSelector()}

        {(theme === 'light' || theme === 'dark') && renderPresetThemes(theme)}
      </div>

      <div className="p-5 border-t border-border bg-card-background flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors font-medium border border-border"
        >
          Close
        </button>
      </div>
    </Drawer>
  );
};

export default ThemeDrawer;
