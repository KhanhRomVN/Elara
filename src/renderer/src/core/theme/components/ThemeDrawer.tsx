import React, { useMemo, memo } from 'react';
import { useTheme } from '../ThemeProvider';
import { Drawer } from '../../../shared/components/ui/drawer';
import { X, Moon, Sun, Palette } from 'lucide-react';
import { PRESET_THEMES } from '../theme-loader';
import { cn } from '../../../shared/lib/utils';

interface ThemeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ThemeDrawer: React.FC<ThemeDrawerProps> = memo(({ isOpen, onClose }) => {
  const { theme, setTheme, applyPresetTheme } = useTheme();

  // Filter to just Light and Dark
  const themes = useMemo(
    () => [
      { value: 'light', label: 'Light', icon: Sun },
      { value: 'dark', label: 'Dark', icon: Moon },
    ],
    [],
  );

  // Cast theme to 'light' | 'dark' safely since we removed system
  const currentMode = theme === 'light' || theme === 'dark' ? theme : 'dark';

  const renderPresetThemes = () => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Preset Themes</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 pb-20">
        {PRESET_THEMES[currentMode]?.map((preset, idx) => {
          return (
            <button
              key={idx}
              onClick={() => applyPresetTheme(preset)}
              className="relative flex flex-col p-3 rounded-md transition-all overflow-hidden bg-card border border-border hover:border-primary/50 hover:scale-[1.02] duration-200 group text-left shadow-sm"
            >
              <div className="w-full h-24 rounded-lg overflow-hidden mb-3 relative border border-border/50">
                <div className="h-3 w-full" style={{ backgroundColor: preset.tailwind.primary }} />
                <div className="flex h-21">
                  <div
                    className="w-1/4 h-full border-r border-border/50"
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
                {/* Primary Color Indicator Dot */}
                <div className="absolute top-2 right-2 bg-background/90 p-1 rounded-full shadow-sm border border-border">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: preset.tailwind.primary }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center w-full px-1">
                <span className="font-semibold text-sm block text-foreground">
                  {preset.name.replace(/Light$|Dark$/, '')}
                </span>
              </div>

              <div className="flex mt-3 gap-1.5 w-full px-1">
                {['primary', 'background', 'cardBackground', 'textPrimary', 'border'].map((k) => (
                  <div
                    key={k}
                    className="h-1.5 flex-1 rounded-full shadow-sm ring-1 ring-inset ring-black/5"
                    style={{
                      backgroundColor: (preset.tailwind as any)[k] || '#ccc',
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
      className="!bg-drawer-background flex flex-col"
    >
      <div className="h-14 flex items-center justify-between px-6 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold text-foreground">Theme Settings</h2>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
            Customize the look and feel
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 -mr-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar">
        <div className="mb-8">
          <h3 className="text-sm font-medium text-foreground mb-3">Mode</h3>
          <div className="grid grid-cols-2 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value as any)}
                className={cn(
                  'flex flex-col items-center justify-center p-4 rounded-lg border transition-all',
                  theme === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card hover:bg-accent hover:text-accent-foreground text-muted-foreground',
                )}
              >
                <Icon className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {renderPresetThemes()}
      </div>

      <div className="p-4 border-t border-border flex gap-3 shrink-0">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors font-medium border border-border text-sm"
        >
          Close
        </button>
      </div>
    </Drawer>
  );
});

export default ThemeDrawer;
