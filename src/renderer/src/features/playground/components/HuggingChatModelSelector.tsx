import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Info, Server, Cpu } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

export interface HuggingChatModel {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  websiteUrl?: string;
  modelUrl?: string;
  datasetUrl?: string;
  promptExamples?: string[];
  parameters?: any;
  providers?: { provider: string; computeType: string; status: string }[];

  unlisted?: boolean;
  logoUrl?: string;
}

interface HuggingChatModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: HuggingChatModel[];
  placeholder?: string;
  disabled?: boolean;
}

export const HuggingChatModelSelector = ({
  value,
  onChange,
  models,
  placeholder = 'Select Model',
  disabled,
}: HuggingChatModelSelectorProps) => {
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
            {selectedModel?.logoUrl && (
              <img
                src={selectedModel.logoUrl}
                alt=""
                className="w-5 h-5 rounded-sm object-contain shrink-0 bg-muted/50"
              />
            )}
            <span className="truncate font-medium">
              {selectedModel?.displayName ||
                selectedModel?.name ||
                selectedModel?.id ||
                placeholder}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-80 w-full min-w-[350px] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
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
                            {model.logoUrl && (
                              <img
                                src={model.logoUrl}
                                alt=""
                                className="w-5 h-5 rounded-sm object-contain shrink-0 bg-muted/50"
                              />
                            )}
                            <span className="font-semibold truncate">
                              {model.displayName || model.name || model.id}
                            </span>
                            {model.unlisted && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold bg-yellow-500/10 text-yellow-500">
                                Unlisted
                              </span>
                            )}
                          </div>
                          {/* Short description or provider list preview */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                            {model.description ? (
                              <span className="truncate max-w-[200px]">{model.description}</span>
                            ) : (
                              <span>{model.id}</span>
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
                              {model.displayName || model.name || model.id}
                            </h4>
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              {model.id}
                            </p>
                            {model.websiteUrl && (
                              <a
                                href={model.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline block mt-1"
                              >
                                Visit Website
                              </a>
                            )}
                          </div>

                          {model.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {model.description}
                            </p>
                          )}

                          <div className="grid grid-cols-1 gap-y-2 text-xs">
                            {model.parameters && Object.keys(model.parameters).length > 0 && (
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold flex items-center gap-1">
                                  <Info className="w-3 h-3" /> Parameters
                                </span>
                                <div className="grid grid-cols-2 gap-2 pl-4">
                                  {Object.entries(model.parameters).map(([k, v]) => (
                                    <div key={k} className="flex flex-col">
                                      <span className="text-muted-foreground capitalize">
                                        {k.replace(/_/g, ' ')}
                                      </span>
                                      <span className="font-medium">{String(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {model.providers && model.providers.length > 0 && (
                              <div className="flex flex-col gap-2 mt-2">
                                <span className="font-semibold flex items-center gap-1">
                                  <Server className="w-3 h-3" /> Providers
                                </span>
                                <div className="space-y-2 pl-4">
                                  {model.providers.map((p, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between border-b pb-1 last:border-0 border-border/50"
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">{p.provider}</span>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                          <Cpu className="w-2.5 h-2.5" /> {p.computeType}
                                        </span>
                                      </div>
                                      <span
                                        className={cn(
                                          'text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold',
                                          p.status === 'live'
                                            ? 'bg-green-500/10 text-green-500'
                                            : 'bg-yellow-500/10 text-yellow-500',
                                        )}
                                      >
                                        {p.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
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
