import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import antigravityIcon from '../../../assets/provider_icons/antigravity.svg';

interface AntigravityModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: any[];
  disabled?: boolean;
}

export const AntigravityModelSelector = ({
  value,
  onChange,
  models,
  disabled,
}: AntigravityModelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
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

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Helper to format model label
  const getModelLabel = (modelName: string) => {
    let label = modelName;
    if (label.startsWith('models/')) label = label.replace('models/', '');
    return label;
  };

  const selectedModel = models.find(
    (m) =>
      m.name === value || m.name === `models/${value}` || m.name?.endsWith(value) || m === value,
  );
  // Handle case where models haven't loaded yet or value is custom
  const selectedLabel = selectedModel ? getModelLabel(selectedModel.name) : getModelLabel(value);

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
            <img src={antigravityIcon} alt="" className="w-5 h-5 shrink-0" />
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
                Object.entries(
                  models.reduce(
                    (groups, model) => {
                      const name = model.name.toLowerCase();
                      let publisher = 'Other';
                      if (name.includes('gemini')) publisher = 'Google';
                      else if (name.includes('claude')) publisher = 'Anthropic';
                      else if (name.includes('chatgpt') || name.includes('gpt'))
                        publisher = 'OpenAI';

                      if (!groups[publisher]) groups[publisher] = [];
                      groups[publisher].push(model);
                      return groups;
                    },
                    {} as Record<string, typeof models>,
                  ),
                )
                  .sort(([a], [b]) => {
                    const order: Record<string, number> = {
                      Google: 0,
                      Anthropic: 1,
                      OpenAI: 2,
                      Other: 3,
                    };
                    return (order[a] ?? 99) - (order[b] ?? 99);
                  })
                  .map(([publisher, groupModels]: [string, any]) => (
                    <div key={publisher}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30 sticky top-0 backdrop-blur-sm z-10">
                        {publisher}
                      </div>
                      {groupModels.map((model: any) => {
                        const modelName = model.name;
                        const isSelected = modelName === value;
                        const label = getModelLabel(modelName);
                        const quota = model.quotaInfo;
                        const pct = quota
                          ? quota.remainingFraction !== undefined
                            ? Math.round(quota.remainingFraction * 100)
                            : null
                          : null;

                        // Format Reset Time
                        const resetDate = quota?.resetTime ? new Date(quota.resetTime) : null;
                        const resetTimeFull = resetDate ? resetDate.toLocaleString() : null;
                        let countdownStr = '';

                        if (resetDate && pct !== null && pct < 100) {
                          const diff = resetDate.getTime() - now;
                          if (diff > 0) {
                            const hours = Math.floor(diff / (1000 * 60 * 60));
                            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                            countdownStr = `${hours.toString().padStart(2, '0')}:${minutes
                              .toString()
                              .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                          } else {
                            countdownStr = 'Ready';
                          }
                        }

                        return (
                          <Tooltip.Root key={modelName} delayDuration={0}>
                            <Tooltip.Trigger asChild>
                              <div
                                onClick={() => {
                                  onChange(modelName);
                                  setIsOpen(false);
                                }}
                                className={cn(
                                  'relative flex select-none items-center justify-between rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer group border-b last:border-0 border-border/50',
                                  isSelected && 'bg-accent text-accent-foreground',
                                )}
                              >
                                <div className="flex flex-col gap-0.5 max-w-[95%]">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold truncate">{label}</span>
                                    {
                                      /* Quota Badge */
                                      (pct !== null || countdownStr) && (
                                        <span
                                          className={cn(
                                            'text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold flex items-center gap-1',
                                            pct !== null
                                              ? pct > 50
                                                ? 'bg-green-500/10 text-green-500'
                                                : pct > 20
                                                  ? 'bg-yellow-500/10 text-yellow-500'
                                                  : 'bg-red-500/10 text-red-500'
                                              : countdownStr === 'Ready'
                                                ? 'bg-green-500/10 text-green-500' // Unknown percentage but Ready -> Green
                                                : 'bg-yellow-500/10 text-yellow-500', // Unknown percentage and waiting -> Yellow/Warning
                                          )}
                                        >
                                          {pct !== null && `${pct}% `}
                                          {countdownStr && (
                                            <span
                                              className={cn(
                                                'font-mono',
                                                pct !== null &&
                                                  'opacity-75 ml-1 border-l pl-1 border-current',
                                              )}
                                            >
                                              {countdownStr}
                                            </span>
                                          )}
                                        </span>
                                      )
                                    }
                                  </div>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {modelName}
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
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-bold text-base">{label}</h4>
                                    <p className="text-xs text-muted-foreground">{modelName}</p>
                                  </div>

                                  {(model.version || model.displayName || model.description) && (
                                    <div className="border-t pt-2">
                                      <h5 className="font-semibold text-xs mb-2 text-primary/80">
                                        Model Information
                                      </h5>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                        {model.version && (
                                          <div className="flex flex-col">
                                            <span className="text-muted-foreground">Version</span>
                                            <span className="font-medium">{model.version}</span>
                                          </div>
                                        )}
                                        {model.displayName && (
                                          <div className="flex flex-col">
                                            <span className="text-muted-foreground">
                                              Display Name
                                            </span>
                                            <span className="font-medium">{model.displayName}</span>
                                          </div>
                                        )}
                                      </div>
                                      {model.description && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                          {model.description}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {(model.inputTokenLimit ||
                                    model.outputTokenLimit ||
                                    model.supportedGenerationMethods) && (
                                    <div className="border-t pt-2">
                                      <h5 className="font-semibold text-xs mb-2 text-primary/80">
                                        Capabilities
                                      </h5>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                        {model.inputTokenLimit && (
                                          <div className="flex flex-col">
                                            <span className="text-muted-foreground">
                                              Input Limit
                                            </span>
                                            <span className="font-medium">
                                              {model.inputTokenLimit.toLocaleString()}
                                            </span>
                                          </div>
                                        )}
                                        {model.outputTokenLimit && (
                                          <div className="flex flex-col">
                                            <span className="text-muted-foreground">
                                              Output Limit
                                            </span>
                                            <span className="font-medium">
                                              {model.outputTokenLimit.toLocaleString()}
                                            </span>
                                          </div>
                                        )}
                                        {model.supportedGenerationMethods && (
                                          <div className="flex flex-col col-span-2">
                                            <span className="text-muted-foreground">Methods</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {model.supportedGenerationMethods.map((m: string) => (
                                                <span
                                                  key={m}
                                                  className="text-[9px] px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded"
                                                >
                                                  {m}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {(model.temperature !== undefined ||
                                    model.topP !== undefined ||
                                    model.topK !== undefined) && (
                                    <div className="border-t pt-2">
                                      <h5 className="font-semibold text-xs mb-2 text-primary/80">
                                        Defaults
                                      </h5>
                                      <div className="grid grid-cols-3 gap-x-2 gap-y-2 text-xs">
                                        {model.temperature !== undefined && (
                                          <div className="flex flex-col">
                                            <span className="text-muted-foreground">Temp</span>
                                            <span className="font-medium">{model.temperature}</span>
                                          </div>
                                        )}
                                        {model.topP !== undefined && (
                                          <div className="flex flex-col">
                                            <span className="text-muted-foreground">Top P</span>
                                            <span className="font-medium">{model.topP}</span>
                                          </div>
                                        )}
                                        {model.topK !== undefined && (
                                          <div className="flex flex-col">
                                            <span className="text-muted-foreground">Top K</span>
                                            <span className="font-medium">{model.topK}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <div className="border-t pt-2">
                                    <h5 className="font-semibold text-xs mb-2 text-primary/80">
                                      Quota Information
                                    </h5>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                      <div className="flex flex-col">
                                        <span className="text-muted-foreground">Remaining</span>
                                        <span
                                          className={cn(
                                            'font-medium',
                                            pct !== null &&
                                              (pct > 50
                                                ? 'text-green-500'
                                                : pct > 20
                                                  ? 'text-yellow-500'
                                                  : 'text-red-500'),
                                          )}
                                        >
                                          {pct !== null ? `${pct}%` : 'Unknown'}
                                        </span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-muted-foreground">Reset Time</span>
                                        <span className="font-medium">
                                          {resetTimeFull || 'N/A'}
                                        </span>
                                      </div>
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
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
};
