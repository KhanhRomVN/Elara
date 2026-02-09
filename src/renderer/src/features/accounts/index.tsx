import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  AlignEndVertical,
  Upload,
  Download,
  Trash2,
  Filter,
  Activity,
} from 'lucide-react';
import { useAccounts } from './hooks/useAccounts';
import { AccountsTable } from './components/AccountsTable';
import { AddAccountDialog } from './components/AddAccountDialog';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';
import { CustomSelect } from '../playground/components/CustomSelect';
import { DualRangeSlider } from '../../shared/components/ui/DualRangeSlider';
import { MultiSelectCombobox } from '../../shared/components/ui/MultiSelectCombobox';

import { cn } from '../../shared/lib/utils';
import { toast } from 'sonner';

export const Accounts = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    accounts,
    // unused: rawAccounts
    allAccounts, // All fetched accounts (unfiltered)
    allStats,
    loading,
    serverPort,
    providerConfigs,
    searchQuery,
    setSearchQuery,
    pagination,
    selectedAccounts,
    confirmOpen,
    setConfirmOpen,
    deleteItem,
    deleteLoading,
    executeDelete,
    fetchAccounts,
    handleDelete,
    handleBulkDelete,
    toggleSelection,
    toggleAll,

    // New Filters
    providerFilter,
    setProviderFilter,
    emailFilter,
    setEmailFilter,
    successRateRange,
    setSuccessRateRange,
    totalReqRange,
    setTotalReqRange,
    totalTokenRange,
    setTotalTokenRange,
  } = useAccounts();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImport = async () => {
    try {
      const result = await (window as any).api.accounts.import();
      if (result.success) {
        fetchAccounts(pagination.page, pagination.limit, true);
        toast.success(`Successfully imported: ${result.added} added, ${result.updated} updated.`);
      } else if (!result.canceled) {
        toast.error('Import failed: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to import:', error);
      toast.error('Failed to import accounts');
    }
  };

  const handleExport = async () => {
    try {
      await (window as any).api.accounts.export();
      toast.success('Accounts exported successfully');
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Failed to export accounts');
    }
  };

  const allVisibleSelected =
    accounts.length > 0 && accounts.every((acc) => selectedAccounts.has(acc.id));
  const someVisibleSelected = accounts.some((acc) => selectedAccounts.has(acc.id));

  // Range Slider Wrapper
  const RangeFilter = ({
    label,
    value,
    onChange,
    min = 0,
    max = 100,
    unit = '',
    step = 1,
  }: {
    label: string;
    value: [number, number] | null;
    onChange: (val: [number, number] | null) => void;
    min?: number;
    max?: number;
    unit?: string;
    step?: number;
  }) => {
    const effectiveValue: [number, number] = value
      ? [Math.max(min, value[0]), Math.min(max, value[1])]
      : [min, max];
    const isFiltered = value !== null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-bold text-muted-foreground">{label}</label>
          <span
            className={cn(
              'text-[10px] font-mono',
              isFiltered ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {effectiveValue[0]}
            {unit} - {effectiveValue[1]}
            {unit}
          </span>
        </div>

        <DualRangeSlider
          min={min}
          max={max}
          step={step}
          value={effectiveValue}
          onValueChange={onChange}
          className="py-1"
        />
      </div>
    );
  };

  // Calculate dynamic stats ranges from ALL stats (global context)
  const statsRanges = useMemo(() => {
    if (!allStats || allStats.length === 0) {
      return {
        req: { min: 0, max: 0, hasData: false },
        token: { min: 0, max: 0, hasData: false },
        success: { min: 0, max: 0, hasData: false },
      };
    }

    const reqs = allStats.map((s) => s.total_requests || 0);
    const tokens = allStats.map((s) => s.total_tokens || 0);
    const successRates = allStats
      .map((s) => {
        const total = s.total_requests || 0;
        return total > 0 ? ((s.successful_requests || 0) / total) * 100 : 0;
      })
      .filter((rate) => rate > 0); // Filter out null/0 rates

    const minReq = Math.min(...reqs);
    const maxReq = Math.max(...reqs);
    const minToken = Math.min(...tokens);
    const maxToken = Math.max(...tokens);
    const minSuccess = successRates.length > 0 ? Math.min(...successRates) : 0;
    const maxSuccess = successRates.length > 0 ? Math.max(...successRates) : 0;

    return {
      req: {
        min: minReq,
        max: maxReq > minReq ? maxReq : minReq + 10,
        hasData: maxReq > 0,
      },
      token: {
        min: minToken,
        max: maxToken > minToken ? maxToken : minToken + 100,
        hasData: maxToken > 0,
      },
      success: {
        min: Math.floor(minSuccess),
        max: Math.ceil(maxSuccess) || 100,
        hasData: successRates.length > 0,
      },
    };
  }, [allStats]);

  // Extract unique emails from allAccounts for combobox options
  const emailOptions = useMemo(() => {
    if (!allAccounts || allAccounts.length === 0) return [];
    const uniqueEmails = Array.from(new Set(allAccounts.map((acc) => acc.email).filter(Boolean)));
    return uniqueEmails;
  }, [allAccounts]);

  if (loading && accounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading accounts...</p>
        </div>
      </div>
    );
  }

  const providerOptions = [
    { value: 'all', label: 'All Providers' },
    ...providerConfigs.map((p) => ({
      value: p.provider_id,
      label: p.provider_name,
      icon: p.favicon || p.icon, // Add favicon support
    })),
  ];

  return (
    <div className="h-full flex flex-row bg-background">
      {/* 1. Sidebar (Full Height) - Increased width to 320px */}
      <div className="w-80 border-r border-border bg-card/30 flex flex-col shrink-0 h-full transition-all">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-xs font-medium text-primary">
              {pagination.total}
            </span>
          </div>
        </div>

        {/* Sidebar Content (Filters) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          {/* Main Filters Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Filter className="w-3 h-3" /> Filters
            </h3>

            {/* Provider Filter */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                Provider
              </label>
              <CustomSelect
                value={providerFilter || 'all'}
                onChange={(val) => setProviderFilter(val === 'all' ? '' : val)}
                options={providerOptions}
                placeholder="Select Provider"
              />
            </div>

            {/* Email Filter - Multi-Select Combobox */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                Email / Name
              </label>
              <MultiSelectCombobox
                value={emailFilter}
                onChange={setEmailFilter}
                options={emailOptions}
                placeholder="Filter by email..."
              />
            </div>
          </div>

          {/* Conditional rendering for Activity Stats - only show if has data */}
          {(statsRanges.success.hasData ||
            statsRanges.req.hasData ||
            statsRanges.token.hasData) && (
            <>
              <div className="h-px bg-border/50" />

              {/* Activity / Stats Filters */}
              <div className="space-y-5">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-3 h-3" /> Activity Stats
                </h3>

                {statsRanges.success.hasData && (
                  <RangeFilter
                    label="Success Rate"
                    value={successRateRange}
                    onChange={setSuccessRateRange}
                    min={statsRanges.success.min}
                    max={statsRanges.success.max}
                    unit="%"
                  />
                )}

                {statsRanges.req.hasData && (
                  <RangeFilter
                    label="Total Requests"
                    value={totalReqRange}
                    onChange={setTotalReqRange}
                    min={statsRanges.req.min}
                    max={statsRanges.req.max}
                  />
                )}

                {statsRanges.token.hasData && (
                  <RangeFilter
                    label="Total Tokens"
                    value={totalTokenRange}
                    onChange={setTotalTokenRange}
                    min={statsRanges.token.min}
                    max={statsRanges.token.max}
                  />
                )}
              </div>
            </>
          )}

          {/* Load Limits - Hidden for now since data is 0 */}
          {/* User feedback: Max Load all 0, so we hide this section */}
        </div>
      </div>

      {/* 2. Content Area (HeaderBar + Table) */}
      <div className="flex-1 flex flex-col min-w-0 bg-background h-full">
        {/* Content HeaderBar (Search + Actions) */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          {/* Search Bar (Global) */}
          <div className="relative w-80">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background/50 pl-8 pr-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {selectedAccounts.size > 0 && (
              <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-right-4">
                <span className="text-xs text-muted-foreground">
                  {selectedAccounts.size} selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                  title="Delete Selected"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => setDialogOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              title="Add Account"
            >
              <Plus className="w-5 h-5" />
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
                  showDropdown && 'bg-muted text-foreground',
                )}
                title="More Options"
              >
                <AlignEndVertical className="w-4 h-4" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95 duration-200 z-50">
                  <div className="p-1">
                    <button
                      onClick={() => {
                        handleImport();
                        setShowDropdown(false);
                      }}
                      className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Import (JSON)
                    </button>
                    <button
                      onClick={() => {
                        handleExport();
                        setShowDropdown(false);
                      }}
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

        {/* Table Area */}
        <div className="flex-1 overflow-auto">
          <AccountsTable
            accounts={accounts}
            loading={loading}
            selectedAccounts={selectedAccounts}
            toggleSelection={toggleSelection}
            toggleAll={toggleAll}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            providerConfigs={providerConfigs}
            onDelete={handleDelete}
          />
        </div>

        {/* Pagination Footer */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0 bg-card/30">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              <span>of</span>
              <span className="font-medium text-foreground">{pagination.total}</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7 disabled:opacity-50 transition-colors"
                onClick={() => fetchAccounts(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
                title="Previous Page"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>

              <button
                className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7 disabled:opacity-50 transition-colors"
                onClick={() => fetchAccounts(pagination.page + 1)}
                disabled={pagination.page === pagination.total_pages || loading}
                title="Next Page"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AddAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchAccounts(pagination.page, pagination.limit, true)}
        serverPort={serverPort}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={executeDelete}
        loading={deleteLoading}
        title={deleteItem ? `Delete account ${deleteItem.email}?` : 'Delete accounts'}
        count={deleteItem ? 1 : selectedAccounts.size}
      />
    </div>
  );
};

export default Accounts;
