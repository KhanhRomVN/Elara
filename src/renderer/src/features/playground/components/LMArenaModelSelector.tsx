import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

interface LMArenaModel {
  id: string;
  name: string;
  organization?: string;
  provider?: string;
  publicName?: string;
  displayName?: string;
  rank?: number;
  rankByModality?: {
    chat?: number;
    webdev?: number;
    image?: number;
  };
  capabilities?: {
    inputCapabilities?: {
      text?: boolean;
      image?: boolean;
    };
    outputCapabilities?: {
      text?: boolean;
      web?: boolean;
      image?: boolean;
    };
  };
}

interface LMArenaModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: LMArenaModel[];
  placeholder?: string;
  disabled?: boolean;
}

export const LMArenaModelSelector = ({
  value,
  onChange,
  models,
  placeholder = 'Select Model',
  disabled,
}: LMArenaModelSelectorProps) => {
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

  const selectedModel = models.find((m) => m.id === value);

  return (
    <Tooltip.Provider>
      <div className="relative text-left w-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'h-10 w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-accent/50',
            !value && 'text-muted-foreground',
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <span className="truncate font-medium">
              {selectedModel?.displayName || selectedModel?.name || placeholder}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-80 w-full min-w-[400px] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
            <div className="p-1">
              {models.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">No models found</div>
              ) : (
                models.map((model) => (
                  <Tooltip.Root key={model.id} delayDuration={0}>
                    <Tooltip.Trigger asChild>
                      <div
                        onClick={() => {
                          onChange(model.id);
                          setIsOpen(false);
                        }}
                        className={cn(
                          'relative flex select-none items-center justify-between rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer group border-b last:border-0 border-border/50',
                          value === model.id && 'bg-accent text-accent-foreground',
                        )}
                      >
                        <div className="flex flex-col gap-0.5 max-w-[95%]">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">
                              {model.displayName || model.name}
                            </span>
                            {model.rank !== undefined && model.rank < 10 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold bg-yellow-500/10 text-yellow-500">
                                TOP {model.rank}
                              </span>
                            )}
                          </div>
                        </div>
                        {value === model.id && <Check className="h-4 w-4" />}
                      </div>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="z-50 overflow-y-auto max-h-[500px] rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 data-[side=right]:slide-in-from-left-2 max-w-sm"
                        side="right"
                        sideOffset={10}
                        collisionPadding={20}
                      >
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-bold text-base">
                              {model.displayName || model.name}
                            </h4>
                            <p className="text-xs text-muted-foreground">{model.id}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Organization</span>
                              <span className="font-medium capitalize">
                                {model.organization || '-'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Provider</span>
                              <span className="font-medium capitalize">
                                {model.provider || '-'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Global Rank</span>
                              <span className="font-medium">#{model.rank || '-'}</span>
                            </div>
                          </div>

                          {model.rankByModality && (
                            <div className="border-t pt-2">
                              <h5 className="font-semibold text-xs mb-2 text-primary/80">
                                Rankings
                              </h5>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {Object.entries(model.rankByModality).map(([modality, rank]) => (
                                  <div key={modality} className="flex justify-between gap-2">
                                    <span className="text-muted-foreground capitalize">
                                      {modality}
                                    </span>
                                    <span className="font-medium">#{rank}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {model.capabilities && (
                            <div className="border-t pt-2">
                              <h5 className="font-semibold text-xs mb-2 text-primary/80">
                                Capabilities
                              </h5>
                              <div className="space-y-2">
                                {model.capabilities.inputCapabilities && (
                                  <div className="flex gap-2 items-center">
                                    <span className="text-[10px] text-muted-foreground uppercase">
                                      Input
                                    </span>
                                    <div className="flex gap-1">
                                      {Object.entries(model.capabilities.inputCapabilities).map(
                                        ([cap, enabled]) =>
                                          enabled && (
                                            <span
                                              key={cap}
                                              className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded capitalize"
                                            >
                                              {cap}
                                            </span>
                                          ),
                                      )}
                                    </div>
                                  </div>
                                )}
                                {model.capabilities.outputCapabilities && (
                                  <div className="flex gap-2 items-center">
                                    <span className="text-[10px] text-muted-foreground uppercase">
                                      Output
                                    </span>
                                    <div className="flex gap-1">
                                      {Object.entries(model.capabilities.outputCapabilities).map(
                                        ([cap, enabled]) =>
                                          enabled && (
                                            <span
                                              key={cap}
                                              className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded capitalize"
                                            >
                                              {cap}
                                            </span>
                                          ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <Tooltip.Arrow className="fill-popover" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
};
