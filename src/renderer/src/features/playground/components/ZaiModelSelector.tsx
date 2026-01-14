import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import zaiIcon from '../../../assets/provider_icons/zai.svg';

interface ZaiModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: any[];
  disabled?: boolean;
}

export const ZaiModelSelector = ({ value, onChange, models, disabled }: ZaiModelSelectorProps) => {
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
  const selectedLabel = selectedModel ? selectedModel.name : value;

  return (
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
          <img src={zaiIcon} alt="" className="w-5 h-5 shrink-0" />
          <span className="truncate font-medium">{selectedLabel}</span>
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full min-w-[180px] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
          <div className="p-1">
            {models.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">No models found</div>
            ) : (
              models.map((model) => (
                <div
                  key={model.id}
                  onClick={() => {
                    onChange(model.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'relative flex select-none items-center justify-between rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer',
                    value === model.id && 'bg-accent text-accent-foreground',
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium">{model.name}</span>
                  </div>
                  {value === model.id && <Check className="h-4 w-4" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
