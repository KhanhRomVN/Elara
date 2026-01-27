import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search, Globe } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import * as Flags from 'country-flag-icons/react/3x2';

interface LanguageSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

interface LanguageOption {
  code: string;
  flag: keyof typeof Flags;
  label: string;
}

export const LanguageSelector = ({ value, onChange, className }: LanguageSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Curated list of common languages in AI
  const languages: LanguageOption[] = useMemo(() => {
    const langCodes = [
      { code: 'vi', flag: 'VN' },
      { code: 'en', flag: 'US' },
      { code: 'zh', flag: 'CN' },
      { code: 'ja', flag: 'JP' },
      { code: 'ko', flag: 'KR' },
      { code: 'fr', flag: 'FR' },
      { code: 'de', flag: 'DE' },
      { code: 'es', flag: 'ES' },
      { code: 'pt', flag: 'PT' },
      { code: 'ru', flag: 'RU' },
      { code: 'it', flag: 'IT' },
      { code: 'ar', flag: 'SA' },
      { code: 'hi', flag: 'IN' },
      { code: 'tr', flag: 'TR' },
      { code: 'nl', flag: 'NL' },
      { code: 'pl', flag: 'PL' },
    ];

    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });

    return langCodes
      .map((item) => ({
        code: item.code,
        flag: item.flag as keyof typeof Flags,
        label: displayNames.of(item.code) || item.code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en'));
  }, []);

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

  const selectedOption = languages.find((opt) => opt.code === value);

  const filteredOptions = searchQuery
    ? languages.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          opt.code.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : languages;

  const FlagComponent = (code: keyof typeof Flags) => {
    const Flag = Flags[code];
    // @ts-ignore
    return Flag ? (
      <Flag className="w-4 h-3 outline outline-1 outline-border/20 rounded-sm object-cover" />
    ) : null;
  };

  return (
    <div className={cn('relative text-left', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'h-10 px-3 flex items-center gap-2 rounded-md border border-input bg-background text-sm transition-all hover:bg-accent/50 focus:outline-none',
          !value && 'text-muted-foreground',
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedOption ? (
            <>
              {FlagComponent(selectedOption.flag)}
              <span className="font-medium truncate">{selectedOption.label}</span>
            </>
          ) : (
            <>
              <Globe className="h-4 w-4 opacity-50 shrink-0" />
              <span className="truncate">Response Language</span>
            </>
          )}
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-56 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="p-2 border-b bg-background/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search language..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-input bg-background focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-80 overflow-auto p-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
            <div
              onClick={() => {
                onChange(null);
                setIsOpen(false);
                setSearchQuery('');
              }}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                value === null && 'bg-accent text-accent-foreground',
              )}
            >
              <Globe className="h-4 w-4 opacity-50" />
              <span>Default (Auto)</span>
            </div>
            <div className="h-px bg-border my-1" />
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                No matches found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.code}
                  onClick={() => {
                    onChange(option.code);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                    value === option.code && 'bg-accent text-accent-foreground',
                  )}
                >
                  {FlagComponent(option.flag)}
                  <span className="truncate">{option.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground opacity-50 uppercase">
                    {option.code}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
