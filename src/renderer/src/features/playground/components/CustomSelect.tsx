import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { ModelTooltip } from './ModelTooltip';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
    subLabel?: string | React.ReactNode;
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
    subLabel?: string | React.ReactNode;
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
                <ModelTooltip
                  key={option.value}
                  content={
                    <div className="space-y-1">
                      <div className="font-semibold text-sm">{option.label}</div>
                      {option.details?.context_length !== undefined && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Context Window:</span>
                          <span className="font-mono">
                            {option.details.context_length
                              ? option.details.context_length.toLocaleString()
                              : 'Unknown'}
                          </span>
                        </div>
                      )}
                      {option.details?.description && (
                        <div className="text-muted-foreground leading-relaxed">
                          {option.details.description}
                        </div>
                      )}
                    </div>
                  }
                >
                  <div
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
                    <div className="flex items-center gap-2 truncate w-full">
                      {option.icon &&
                        (typeof option.icon === 'string' ? (
                          <img src={option.icon} alt="" className="w-5 h-5 shrink-0" />
                        ) : (
                          option.icon
                        ))}
                      <span className="truncate font-medium">{option.label}</span>
                      {option.subLabel && (
                        <span className="ml-2 text-xs text-muted-foreground truncate opacity-70">
                          {option.subLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </ModelTooltip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
