import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import geminiIcon from '../../../assets/provider_icons/gemini.svg';

interface GeminiModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: any[];
  disabled?: boolean;
}

export const GeminiModelSelector = ({
  value,
  onChange,
  models,
  disabled,
}: GeminiModelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedModel = models.find((m) => m.id === value || m.name === value);
  const selectedLabel = selectedModel ? selectedModel.name : value;

  return (
    <Tooltip.Provider>
      <div className="relative text-left w-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'h-10 w-full min-w-[140px] flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-accent/50',
            !value && 'text-muted-foreground',
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <img src={geminiIcon} alt="" className="w-5 h-5 shrink-0" />
            <span className="truncate font-medium">{selectedLabel}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-80 w-[400px] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
            <div className="p-1">
              {models.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">No models found</div>
              ) : (
                <div className="space-y-1">
                  {models.map((model) => {
                    const isSelected = model.id === value;
                    return (
                      <Tooltip.Root key={model.id} delayDuration={0}>
                        <Tooltip.Trigger asChild>
                          <div
                            onClick={() => {
                              onChange(model.id);
                              setIsOpen(false);
                            }}
                            className={cn(
                              'relative flex select-none items-center justify-between rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer border-b last:border-0 border-border/50',
                              isSelected && 'bg-accent text-accent-foreground',
                            )}
                          >
                            <div className="flex flex-col gap-0.5 max-w-[95%]">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold truncate">{model.name}</span>
                                {model.isDefault && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-bold">
                                    Default
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate">
                                {model.description}
                              </span>
                            </div>
                            {isSelected && <Check className="h-4 w-4" />}
                          </div>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="z-50 overflow-y-auto max-h-[500px] rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 data-[side=right]:slide-in-from-left-2 max-w-sm"
                            side="right"
                            sideOffset={10}
                            collisionPadding={20}
                          >
                            <div className="space-y-2">
                              <div>
                                <h4 className="font-bold text-base">{model.name}</h4>
                                <p className="text-xs text-muted-foreground">ID: {model.id}</p>
                              </div>
                              <div className="border-t pt-2">
                                <div className="text-xs text-muted-foreground">
                                  {model.description}
                                </div>
                              </div>
                            </div>
                            <Tooltip.Arrow className="fill-popover" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
};
