import { useEffect, useRef, useState } from 'react';
import { AnimatedPage } from '../../shared/components/AnimatedPage';
import { Loader2 } from 'lucide-react';
import { useModels } from './hooks/useModels';
import { ModelsHeader } from './components/ModelsHeader';
import { ModelsTable } from './components/ModelsTable';
import { ModelsPagination } from './components/ModelsPagination';
import { InsertSequenceDialog } from './components/InsertSequenceDialog';
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
    period,
    setPeriod,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading models...</p>
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage className="flex-1 flex flex-col space-y-6 p-6 min-h-0">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Models</h2>
        <p className="text-muted-foreground">Manage model sequences for priority ordering.</p>
      </div>

      <ModelsHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedProviderId={selectedProviderId}
        setSelectedProviderId={setSelectedProviderId}
        period={period}
        setPeriod={setPeriod}
        providers={providers}
        onRefresh={() => fetchData()}
      />

      <div
        ref={tableContainerRef}
        className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]"
      >
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

        <ModelsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={startIndex + paginatedModels.length}
          totalItems={flatModels.length}
          onPageChange={setCurrentPage}
        />
      </div>

      <InsertSequenceDialog
        isOpen={insertDialogOpen}
        onClose={() => setInsertDialogOpen(false)}
        targetModel={insertTargetModel}
        maxSequence={getMaxSequence()}
        onInsert={handleInsert}
      />
    </AnimatedPage>
  );
};
