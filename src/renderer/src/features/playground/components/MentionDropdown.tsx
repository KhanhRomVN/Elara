import React, { useEffect, useRef } from 'react';
import { File, Folder, Share2, Cpu, Search } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { getFileIconPath, getFolderIconPath } from '../../../shared/utils/fileIconMapper';

interface MentionOption {
  id: string;
  label: string;
  type: 'File' | 'Folder' | 'MCP' | 'Skill';
  icon?: React.ReactNode;
}

interface MentionDropdownProps {
  isOpen: boolean;
  options: MentionOption[];
  selectedIndex: number;
  onSelect: (option: MentionOption) => void;
  searchTerm: string;
  mode?: 'initial' | 'file' | 'folder' | 'mcp' | 'skill';
}

export const MentionDropdown = ({
  isOpen,
  options,
  selectedIndex,
  onSelect,
  searchTerm,
  mode = 'initial',
}: MentionDropdownProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current && selectedIndex >= 0) {
      const selectedElement = scrollContainerRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const defaultOptions: MentionOption[] = [
    {
      id: 'file',
      label: 'File',
      type: 'File',
      icon: <img src={getFileIconPath('')} className="w-4 h-4 object-contain" alt="file" />,
    },
    {
      id: 'folder',
      label: 'Folder',
      type: 'Folder',
      icon: <img src={getFolderIconPath(false)} className="w-4 h-4 object-contain" alt="folder" />,
    },
    { id: 'mcp', label: 'MCP', type: 'MCP', icon: <Share2 className="w-4 h-4" /> },
    { id: 'skill', label: 'Skill', type: 'Skill', icon: <Cpu className="w-4 h-4" /> },
  ];

  const showInitial = mode === 'initial' && !searchTerm;
  const displayOptions = showInitial ? defaultOptions : options;

  // Group by type for search results
  const groupedOptions = displayOptions.reduce(
    (acc, opt) => {
      if (!acc[opt.type]) acc[opt.type] = [];
      acc[opt.type].push(opt);
      return acc;
    },
    {} as Record<string, MentionOption[]>,
  );

  return (
    <div
      className={cn(
        'absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] bg-dropdown-background border border-dropdown-border shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2',
        'rounded-xl border-b',
      )}
    >
      <div
        ref={scrollContainerRef}
        className="max-h-[300px] overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-1"
      >
        {mode !== 'initial' && (
          <div className="px-3 py-1 text-[10px] font-bold text-primary/70 uppercase tracking-tighter flex items-center justify-between border-b border-dropdown-border/50 mb-1 pb-1.5">
            <span>Searching {mode}...</span>
            <span className="text-[9px] opacity-60 normal-case font-normal italic">
              Backspace to go back
            </span>
          </div>
        )}

        {showInitial
          ? displayOptions.map((opt, index) => (
              <button
                key={opt.id}
                data-index={index}
                onClick={() => onSelect(opt)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left',
                  selectedIndex === index
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-dropdown-itemHover text-foreground',
                )}
              >
                <span className="shrink-0 opacity-80">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))
          : Object.entries(groupedOptions).map(([type, opts]) => (
              <div key={type} className="flex flex-col gap-0.5">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">
                  {type}
                </div>
                {opts.map((opt) => {
                  // Find global index for keyboard navigation
                  const globalIndex = displayOptions.indexOf(opt);
                  return (
                    <button
                      key={opt.id}
                      data-index={globalIndex}
                      onClick={() => onSelect(opt)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left',
                        selectedIndex === globalIndex
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-dropdown-itemHover text-foreground',
                      )}
                    >
                      <span className="shrink-0 opacity-80">
                        {opt.type === 'File' && (
                          <img
                            src={getFileIconPath(opt.label)}
                            className="w-3.5 h-3.5 object-contain"
                            alt="file"
                          />
                        )}
                        {opt.type === 'Folder' && (
                          <img
                            src={getFolderIconPath(false)}
                            className="w-3.5 h-3.5 object-contain"
                            alt="folder"
                          />
                        )}
                        {opt.type === 'MCP' && <Share2 className="w-3.5 h-3.5" />}
                        {opt.type === 'Skill' && <Cpu className="w-3.5 h-3.5" />}
                      </span>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}

        {searchTerm && displayOptions.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground italic flex flex-col items-center gap-2">
            <Search className="w-6 h-6 opacity-20" />
            No results found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
};
