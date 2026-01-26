import { Search, Plus, AlignEndVertical, Upload, Download, Trash2 } from 'lucide-react';
import { CustomSelect } from '../../playground/components/CustomSelect';
import { StatsPeriod } from '../../models/types';
import { useState, useRef, useEffect } from 'react';

interface AccountsHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  period: StatsPeriod;
  setPeriod: (period: StatsPeriod) => void;
  selectedCount: number;
  onAdd: () => void;
  onDeleteSelected: () => void;
  onImport: () => void;
  onExport: () => void;
}

export const AccountsHeader = ({
  searchQuery,
  setSearchQuery,
  period,
  setPeriod,
  selectedCount,
  onAdd,
  onDeleteSelected,
  onImport,
  onExport,
}: AccountsHeaderProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full max-w-lg">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="relative z-20">
            <CustomSelect
              value={period}
              onChange={(val) => setPeriod(val as StatsPeriod)}
              options={[
                { value: 'day', label: 'Today' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
                { value: 'year', label: 'This Year' },
              ]}
              placeholder="Period"
            />
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
              <button
                onClick={onDeleteSelected}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-destructive/10 text-destructive h-9 px-3"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </button>
            </div>
          )}
          <button
            onClick={onAdd}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
            >
              <AlignEndVertical className="h-4 w-4" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95 duration-200 z-50">
                <div className="p-1">
                  <button
                    onClick={onImport}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Import (JSON)
                  </button>
                  <button
                    onClick={onExport}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export (JSON)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
