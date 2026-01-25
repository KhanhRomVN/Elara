import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Plus } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { ModelTooltip } from './ModelTooltip';

export interface Option {
  value: string;
  label: string;
  subLabel?: string | React.ReactNode;
  icon?: string | React.ReactNode;
  details?: any;
  disabled?: boolean;
  isCustom?: boolean;
  sequence?: number;
}

interface CreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onCreateOption?: (inputValue: string) => void;
}

export const CreatableSelect = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  onCreateOption,
}: CreatableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredOption, setHoveredOption] = useState<Option | null>(null);
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

  const selectedOption =
    options.find((opt) => opt.value === value) || (value ? { value, label: value } : null);

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opt.subLabel &&
        typeof opt.subLabel === 'string' &&
        opt.subLabel.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const showCreateOption =
    searchQuery &&
    !filteredOptions.some((opt) => opt.value.toLowerCase() === searchQuery.toLowerCase());

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreate = () => {
    if (onCreateOption) {
      onCreateOption(searchQuery);
    }
    handleSelect(searchQuery);
  };

  return (
    <div className={cn('relative text-left w-full', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'h-10 w-full flex items-center justify-between gap-4 rounded-lg border border-input bg-zinc-900 border-zinc-800 px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono',
          !value && 'text-muted-foreground',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div className="flex items-center gap-2 truncate flex-1 text-left">
          <div className="flex items-center gap-2 truncate text-zinc-100 flex-1">
            <div className="shrink-0 flex items-center gap-1.5">
              {selectedOption && 'icon' in selectedOption && selectedOption.icon && (
                <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center opacity-70">
                  {typeof selectedOption.icon === 'string' ? (
                    <img src={selectedOption.icon} alt="" className="w-full h-full rounded-sm" />
                  ) : (
                    selectedOption.icon
                  )}
                </div>
              )}
              {selectedOption && 'subLabel' in selectedOption && selectedOption.subLabel && (
                <span className="text-zinc-500 font-mono text-[10px] shrink-0 lowercase">
                  {selectedOption.subLabel}
                </span>
              )}
            </div>
            {selectedOption && 'subLabel' in selectedOption && selectedOption.subLabel && (
              <span className="text-zinc-700 font-light shrink-0">|</span>
            )}
            <span className="truncate font-medium flex-1">
              {selectedOption?.label || placeholder || 'Select...'}
            </span>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full min-w-[380px] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-xl animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
          {/* Search Bar */}
          <div className="p-2 border-b border-zinc-800 bg-zinc-900 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or type to create..."
                className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-zinc-500 font-mono"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Prioritize exact match if it exists
                    const exactMatch = options.find(
                      (opt) => opt.value.toLowerCase() === searchQuery.toLowerCase(),
                    );
                    if (exactMatch) {
                      handleSelect(exactMatch.value);
                    } else if (searchQuery.trim()) {
                      // If no exact match and query is not empty, use the typed value
                      handleCreate();
                    } else if (filteredOptions.length > 0) {
                      // Fallback to first filtered option if query is empty (or no match found but options exist)
                      handleSelect(filteredOptions[0].value);
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-auto p-1 space-y-0.5">
            {showCreateOption && (
              <div
                onClick={handleCreate}
                className="relative flex select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none cursor-pointer text-primary hover:bg-primary/10 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span className="font-medium truncate">Use "{searchQuery}"</span>
              </div>
            )}

            {filteredOptions.length === 0 && !showCreateOption ? (
              <div className="px-2 py-8 text-center text-sm text-zinc-500">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <ModelTooltip
                  key={option.value}
                  content={
                    option.details ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-sm text-zinc-100">{option.label}</div>
                        {option.details?.context_length !== undefined && (
                          <div className="flex justify-between gap-4 text-xs">
                            <span className="text-zinc-400">Context Window:</span>
                            <span className="font-mono text-zinc-300">
                              {option.details.context_length
                                ? option.details.context_length.toLocaleString()
                                : 'Unknown'}
                            </span>
                          </div>
                        )}
                        {option.details?.description && (
                          <div className="text-zinc-400 text-xs leading-relaxed max-w-xs">
                            {option.details.description}
                          </div>
                        )}
                      </div>
                    ) : null
                  }
                >
                  <div
                    onClick={() => {
                      if (option.disabled) return;
                      handleSelect(option.value);
                    }}
                    onMouseEnter={() => setHoveredOption(option)}
                    onMouseLeave={() => setHoveredOption(null)}
                    className={cn(
                      'relative flex select-none items-center rounded-md px-2 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer',
                      !option.disabled && 'hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100',
                      value === option.value && 'bg-zinc-800 text-primary font-medium',
                      option.disabled && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      <div className="w-28 shrink-0 flex items-center justify-end gap-1.5">
                        {option.icon && (
                          <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center opacity-70">
                            {typeof option.icon === 'string' ? (
                              <img
                                src={option.icon}
                                alt=""
                                className="w-full h-full rounded-sm opacity-70"
                              />
                            ) : (
                              option.icon
                            )}
                          </div>
                        )}
                        {option.subLabel && (
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0 lowercase">
                            {option.subLabel}
                          </span>
                        )}
                      </div>
                      {option.subLabel && (
                        <span className="text-zinc-700 font-light shrink-0">|</span>
                      )}
                      <span className="truncate flex-1">{option.label}</span>

                      {option.isCustom && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-700 ml-auto mr-1">
                          History
                        </span>
                      )}
                    </div>
                  </div>
                </ModelTooltip>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
