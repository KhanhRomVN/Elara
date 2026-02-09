import { useEffect, useRef, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Search, Filter, RefreshCw } from 'lucide-react';
import { useModels } from './hooks/useModels';
import { ModelsTable } from './components/ModelsTable';
import { InsertSequenceDialog } from './components/InsertSequenceDialog';
import { CustomSelect } from '../playground/components/CustomSelect';
import { Favicon } from '../../shared/utils/faviconUtils';
import { FlatModel, SortKey } from './types';

export const ModelsPage = () => {
  const {
    flatModels,
    providers,
    loading,
    searchQuery,
    setSearchQuery,
    selectedProviderId,
    setSelectedProviderId,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    fetchData,
    getModelSequence,
    getMaxSequence,
    handleSetNextSequence,
    handleRemoveSequence,
    insertSequence,
  } = useModels();

  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [insertTargetModel, setInsertTargetModel] = useState<FlatModel | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tableContainerRef.current) return;

    const calculateRows = () => {
      if (!tableContainerRef.current) return;
      const headerHeight = 48;
      const footerHeight = 65;
      const rowHeight = 40;
      const containerHeight = tableContainerRef.current.clientHeight;
      const usableHeight = containerHeight - headerHeight - footerHeight;

      if (usableHeight > 100) {
        const calculatedCount = Math.floor(usableHeight / rowHeight);
        setItemsPerPage(Math.max(5, calculatedCount));
      }
    };

    calculateRows();
    const observer = new ResizeObserver(calculateRows);
    observer.observe(tableContainerRef.current);
    return () => observer.disconnect();
  }, [setItemsPerPage]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') setSortDirection('none');
      else setSortDirection('asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const openInsertDialog = (model: FlatModel) => {
    setInsertTargetModel(model);
    setInsertDialogOpen(true);
  };

  const handleInsert = async (modelId: string, providerId: string, sequence: number) => {
    await insertSequence(modelId, providerId, sequence);
    setInsertDialogOpen(false);
    setInsertTargetModel(null);
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedModels = flatModels.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(flatModels.length / itemsPerPage);

  if (loading && flatModels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading models...</p>
        </div>
      </div>
    );
  }

  const providerOptions = [
    { value: 'all', label: 'All Providers' },
    ...providers.map((p) => ({
      value: p.provider_id,
      label: p.provider_name || p.provider_id,
      subLabel: !p.is_enabled ? '(Disabled)' : undefined,
      icon: <Favicon url={p.website} size={16} className="rounded-sm shrink-0" />,
      disabled: false,
    })),
  ];

  return (
    <div className="h-full flex flex-row bg-background">
      {/* 1. Sidebar (Full Height) */}
      <div className="w-80 border-r border-border bg-card/30 flex flex-col shrink-0 h-full transition-all">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Models</h2>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-xs font-medium text-primary">
              {flatModels.length}
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
                value={selectedProviderId}
                onChange={setSelectedProviderId}
                options={providerOptions}
                placeholder="Select Provider"
              />
            </div>
          </div>
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
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background/50 pl-8 pr-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData()}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto" ref={tableContainerRef}>
          <ModelsTable
            models={paginatedModels}
            startIndex={startIndex}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            getModelSequence={getModelSequence}
            maxSequence={getMaxSequence()}
            onSetNext={handleSetNextSequence}
            onOpenInsert={openInsertDialog}
            onRemove={handleRemoveSequence}
          />
        </div>

        {/* Pagination Footer */}
        {flatModels.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0 bg-card/30">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {startIndex + 1}-{Math.min(startIndex + itemsPerPage, flatModels.length)}
              </span>
              <span>of</span>
              <span className="font-medium text-foreground">{flatModels.length}</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7 disabled:opacity-50 transition-colors"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                title="Previous Page"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>

              <button
                className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7 disabled:opacity-50 transition-colors"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                title="Next Page"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      <InsertSequenceDialog
        isOpen={insertDialogOpen}
        onClose={() => setInsertDialogOpen(false)}
        targetModel={insertTargetModel}
        maxSequence={getMaxSequence()}
        onInsert={handleInsert}
      />
    </div>
  );
};

export default ModelsPage;
