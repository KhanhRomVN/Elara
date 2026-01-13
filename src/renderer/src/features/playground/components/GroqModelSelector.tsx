import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  active: boolean;
  context_window: number;
  max_completion_tokens: number;
  public_apps: any;
  features?: {
    chat?: boolean;
    tools?: boolean;
    json_mode?: boolean;
    reasoning?: boolean;
    transcription?: boolean;
    audio_translation?: boolean;
    is_batch_enabled?: boolean;
    max_input_images?: number;
  };
  metadata?: {
    display_name?: string;
    release_stage?: string;
    limits?: {
      requests_per_minute?: number;
      requests_per_day?: number;
      tokens_per_minute?: number;
      tokens_per_day?: number;
      max_file_size?: number;
    };
    model_price?: {
      on_demand?: {
        PriceInTokens?: string;
        PriceOutTokens?: string;
        PriceAudioInSeconds?: string;
      };
      batch?: {
        PriceInTokens?: string;
        PriceOutTokens?: string;
        PriceAudioInSeconds?: string;
      };
    };
  };
}

interface GroqModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: GroqModel[];
  placeholder?: string;
  disabled?: boolean;
}

export const GroqModelSelector = ({
  value,
  onChange,
  models,
  placeholder = 'Select Model',
  disabled,
}: GroqModelSelectorProps) => {
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
            <span className="truncate font-medium">{selectedModel?.id || placeholder}</span>
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
                            <span className="font-semibold truncate">{model.id}</span>
                            {model.metadata?.release_stage && (
                              <span
                                className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold',
                                  model.metadata.release_stage === 'production'
                                    ? 'bg-green-500/10 text-green-500'
                                    : model.metadata.release_stage === 'preview'
                                      ? 'bg-yellow-500/10 text-yellow-500'
                                      : 'bg-muted text-muted-foreground',
                                )}
                              >
                                {model.metadata.release_stage}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">
                            {model.metadata?.display_name || model.owned_by} •{' '}
                            {model.context_window?.toLocaleString()} ctx
                          </span>
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
                              {model.metadata?.display_name || model.id}
                            </h4>
                            <p className="text-xs text-muted-foreground">{model.id}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Owned By</span>
                              <span className="font-medium">{model.owned_by}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Created</span>
                              <span className="font-medium">
                                {new Date(model.created * 1000).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Context Window</span>
                              <span className="font-medium">
                                {model.context_window?.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Max Completion</span>
                              <span className="font-medium">
                                {model.max_completion_tokens?.toLocaleString() || '-'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Active</span>
                              <span
                                className={cn(
                                  'font-medium',
                                  model.active ? 'text-green-500' : 'text-destructive',
                                )}
                              >
                                {model.active ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Release Stage</span>
                              <span className="font-medium capitalize">
                                {model.metadata?.release_stage || '-'}
                              </span>
                            </div>
                          </div>

                          <div className="border-t pt-2">
                            <h5 className="font-semibold text-xs mb-2 text-primary/80">Features</h5>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(model.features || {}).map(
                                ([key, enabled]) =>
                                  enabled &&
                                  typeof enabled === 'boolean' && (
                                    <span
                                      key={key}
                                      className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-md capitalize"
                                    >
                                      {key.replace(/_/g, ' ')}
                                    </span>
                                  ),
                              )}
                              {(model.features?.max_input_images ?? 0) > 0 && (
                                <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-md capitalize">
                                  Images: {model.features?.max_input_images}
                                </span>
                              )}
                            </div>
                          </div>

                          {model.metadata?.limits && (
                            <div className="border-t pt-2">
                              <h5 className="font-semibold text-xs mb-2 text-primary/80">Limits</h5>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Req/Min:</span>{' '}
                                  <span>{model.metadata.limits.requests_per_minute}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Tokens/Min:</span>{' '}
                                  <span>
                                    {model.metadata.limits.tokens_per_minute?.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Req/Day:</span>{' '}
                                  <span>
                                    {model.metadata.limits.requests_per_day?.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Tokens/Day:</span>{' '}
                                  <span>
                                    {model.metadata.limits.tokens_per_day?.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {model.metadata?.model_price?.on_demand && (
                            <div className="border-t pt-2">
                              <h5 className="font-semibold text-xs mb-2 text-primary/80">
                                Pricing (On Demand)
                              </h5>
                              <div className="grid grid-cols-1 gap-y-1 text-xs">
                                {model.metadata.model_price.on_demand.PriceInTokens && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Input:</span>{' '}
                                    <span>
                                      ${model.metadata.model_price.on_demand.PriceInTokens}/tok
                                    </span>
                                  </div>
                                )}
                                {model.metadata.model_price.on_demand.PriceOutTokens && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Output:</span>{' '}
                                    <span>
                                      ${model.metadata.model_price.on_demand.PriceOutTokens}/tok
                                    </span>
                                  </div>
                                )}
                                {model.metadata.model_price.on_demand.PriceAudioInSeconds && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Audio:</span>{' '}
                                    <span>
                                      ${model.metadata.model_price.on_demand.PriceAudioInSeconds}/s
                                    </span>
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
