import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MultiSelectComboboxProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

// Generate consistent color for each email based on hash
const getColorForEmail = (email: string): string => {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Predefined color palette with good contrast
  const colors = [
    { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20' },
    { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/20' },
    { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20' },
    { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/20' },
    { bg: 'bg-pink-500/10', text: 'text-pink-600', border: 'border-pink-500/20' },
    { bg: 'bg-cyan-500/10', text: 'text-cyan-600', border: 'border-cyan-500/20' },
    { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20' },
    { bg: 'bg-indigo-500/10', text: 'text-indigo-600', border: 'border-indigo-500/20' },
    { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-500/20' },
    { bg: 'bg-teal-500/10', text: 'text-teal-600', border: 'border-teal-500/20' },
  ];

  const index = Math.abs(hash) % colors.length;
  return `${colors[index].bg} ${colors[index].text} border ${colors[index].border}`;
};

export const MultiSelectCombobox = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
}: MultiSelectComboboxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(
    (option) => !value.includes(option) && option.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const handleSelect = (option: string) => {
    if (!value.includes(option)) {
      onChange([...value, option]);
    }
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleRemove = (option: string) => {
    onChange(value.filter((v) => v !== option));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
    if (e.key === 'Enter' && inputValue) {
      // Allow custom email input
      handleSelect(inputValue);
      e.preventDefault();
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input Field */}
      <div
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors',
          'focus-within:outline-none focus-within:ring-1 focus-within:ring-ring',
          isOpen && 'ring-1 ring-ring',
        )}
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </div>

      {/* Dropdown Options - Positioned absolutely to overlay badges */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 custom-scrollbar">
          <div className="p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  onClick={() => handleSelect(option)}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  {option}
                </div>
              ))
            ) : inputValue ? (
              <div
                onClick={() => handleSelect(inputValue)}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              >
                Add "{inputValue}"
              </div>
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Type to add email</div>
            )}
          </div>
        </div>
      )}

      {/* Selected Tags/Badges - Below Input (will be overlaid by dropdown when open) */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((item) => (
            <div
              key={item}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium',
                getColorForEmail(item),
              )}
            >
              <span className="max-w-[150px] truncate">{item}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(item);
                }}
                className="hover:opacity-70 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
