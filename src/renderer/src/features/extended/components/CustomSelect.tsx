import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface CustomSelectOption {
  value: string;
  label: string;
  subLabel?: string | React.ReactNode;
  icon?: string | React.ReactNode;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  hasError?: boolean;
}

export const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled,
  className,
  hasError,
}: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchQuery
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const showSearch = options.length > 5;

  return (
    <div className="relative text-left w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'h-10 w-full flex items-center justify-between gap-2 rounded-lg border bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all',
          !value && 'text-zinc-500',
          disabled && 'opacity-50 cursor-not-allowed',
          hasError ? 'border-red-500/50' : 'border-zinc-800',
          !disabled && 'hover:bg-zinc-800/50',
          className,
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon &&
            (typeof selectedOption.icon === 'string' ? (
              <img src={selectedOption.icon} alt="" className="w-5 h-5 shrink-0" />
            ) : (
              selectedOption.icon
            ))}
          <span className="truncate">{selectedOption?.label || placeholder}</span>
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full">
          <div className="max-h-60 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-lg animate-in fade-in-0 zoom-in-95">
            {showSearch && (
              <div className="p-2 border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-zinc-800 bg-zinc-950 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            <div className="max-h-52 overflow-auto p-1 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-zinc-500">No results found</div>
              ) : (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={cn(
                      'relative flex select-none items-center rounded-md px-2 py-2 text-sm outline-none transition-colors cursor-pointer',
                      !option.disabled && 'hover:bg-zinc-800',
                      value === option.value && 'bg-primary/20 text-primary',
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
                      <span className="truncate">{option.label}</span>
                      {option.subLabel && (
                        <span className="ml-auto text-xs text-zinc-500 truncate">
                          {option.subLabel}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
