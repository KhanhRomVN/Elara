import { X, Thermometer } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  temperature: number;
  setTemperature: (val: number) => void;
  isTemperatureSupported: boolean;
}

export const SettingsSidebar = ({
  isOpen,
  onClose,
  temperature,
  setTemperature,
  isTemperatureSupported,
}: SettingsSidebarProps) => {
  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full border-l bg-muted/10 shrink-0 w-[260px] animate-in slide-in-from-right duration-300">
      <div className="flex flex-col h-full gap-6 overflow-hidden overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-4 border-b shrink-0 h-14">
          <div className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg">Settings</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 space-y-6 font-ui">
          <div className="space-y-4 px-2">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold flex items-center gap-2">Temperature</label>
                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  {temperature.toFixed(1)}
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  disabled={!isTemperatureSupported}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className={cn(
                    'w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary',
                    !isTemperatureSupported && 'opacity-50 cursor-not-allowed',
                  )}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              {!isTemperatureSupported && (
                <p className="text-[10px] text-amber-500 bg-amber-500/10 p-2 rounded-md border border-amber-500/20">
                  This provider does not support temperature control.
                </p>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Controls randomness: Lowering results in less random completions. As the temperature
                approaches zero, the model will become deterministic and repetitive.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t p-4 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            Elara Playground
          </p>
        </div>
      </div>
    </div>
  );
};
