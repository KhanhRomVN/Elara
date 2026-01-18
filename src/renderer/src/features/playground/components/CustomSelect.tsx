import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
    icon?: string | React.ReactNode;
    details?: any;
    disabled?: boolean;
  }[];
  placeholder?: string;
  disabled?: boolean;
}

export const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<{
    value: string;
    label: string;
    details?: any;
    disabled?: boolean;
  } | null>(null);
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

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'h-10 w-fit min-w-[140px] flex items-center justify-between gap-4 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-accent/50',
          !value && 'text-muted-foreground',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon &&
            (typeof selectedOption.icon === 'string' ? (
              <img src={selectedOption.icon} alt="" className="w-5 h-5 shrink-0" />
            ) : (
              selectedOption.icon
            ))}
          <span className="truncate font-medium">{selectedOption?.label || placeholder}</span>
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 flex flex-row items-start">
          <div className="max-h-60 w-max min-w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
            <div className="p-1 space-y-1">
              {options.map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    if (option.disabled) return;
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setHoveredOption(option)}
                  onMouseLeave={() => setHoveredOption(null)}
                  className={cn(
                    'relative flex select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer',
                    !option.disabled && 'hover:bg-accent hover:text-accent-foreground',
                    value === option.value && 'bg-accent text-accent-foreground',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.icon &&
                      (typeof option.icon === 'string' ? (
                        <img src={option.icon} alt="" className="w-5 h-5 shrink-0" />
                      ) : (
                        option.icon
                      ))}
                    <span className="truncate font-medium">{option.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {hoveredOption?.details && (
            <div className="ml-2 w-80 max-h-80 overflow-y-auto rounded-md border bg-popover p-4 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
              <h4 className="font-semibold mb-2 text-sm">{hoveredOption.label}</h4>
              <div className="text-xs space-y-2">
                {hoveredOption.details.description && (
                  <p className="text-muted-foreground">{hoveredOption.details.description}</p>
                )}
                {hoveredOption.details.context_length && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Context Window:</span>
                    <span>{hoveredOption.details.context_length.toLocaleString()}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(hoveredOption.details)
                    .filter(
                      ([key]) =>
                        ![
                          'id',
                          'name',
                          'displayName',
                          'description',
                          'context_length',
                          'providers',
                        ].includes(key),
                    )
                    .map(([key, val]) => {
                      if (typeof val === 'object' || val === null) return null;
                      return (
                        <div key={key} className="flex flex-col">
                          <span className="text-[10px] uppercase text-muted-foreground">{key}</span>
                          <span className="truncate" title={String(val)}>
                            {String(val)}
                          </span>
                        </div>
                      );
                    })}
                </div>
                {hoveredOption.details.providers &&
                  Array.isArray(hoveredOption.details.providers) && (
                    <div className="mt-2 pt-2 border-t">
                      <span className="text-[10px] uppercase text-muted-foreground block mb-1">
                        Providers
                      </span>
                      <div className="space-y-1">
                        {hoveredOption.details.providers.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-[10px]">
                            <span>{p.provider}</span>
                            <span
                              className={p.status === 'live' ? 'text-green-500' : 'text-yellow-500'}
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
          )}
        </div>
      )}
    </div>
  );
};
