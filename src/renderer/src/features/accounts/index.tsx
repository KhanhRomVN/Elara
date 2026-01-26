import { useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAccounts } from './hooks/useAccounts';
import { AccountsHeader } from './components/AccountsHeader';
import { AccountsTable } from './components/AccountsTable';
import { AddAccountDialog } from './components/AddAccountDialog';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';

export const Accounts = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const {
    accounts,
    loading,
    serverPort,
    providerConfigs,
    searchQuery,
    setSearchQuery,
    period,
    setPeriod,
    pagination,
    selectedAccounts,
    setSelectedAccounts,
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
  } = useAccounts();

  const handleImport = async () => {
    try {
      const result = await (window as any).api.accounts.import();
      if (result.success) {
        fetchAccounts(pagination.page, pagination.limit, true);
        alert(`Successfully imported: ${result.added} added, ${result.updated} updated.`);
      } else if (!result.canceled) {
        alert('Import failed: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to import:', error);
    }
  };

  const handleExport = async () => {
    try {
      await (window as any).api.accounts.export();
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const allVisibleSelected =
    accounts.length > 0 && accounts.every((acc) => selectedAccounts.has(acc.id));
  const someVisibleSelected = accounts.some((acc) => selectedAccounts.has(acc.id));

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

  return (
    <div className="flex-1 flex flex-col space-y-6 p-6 min-h-0">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
        <p className="text-muted-foreground">
          Manage your connected accounts and view usage stats.
        </p>
      </div>

      <AccountsHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        period={period}
        setPeriod={setPeriod}
        selectedCount={selectedAccounts.size}
        onAdd={() => setDialogOpen(true)}
        onDeleteSelected={handleBulkDelete}
        onImport={handleImport}
        onExport={handleExport}
      />

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
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

        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-4 border-t shrink-0">
            <div className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
              accounts
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 disabled:opacity-50 transition-colors"
                onClick={() => fetchAccounts(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
              <div className="text-sm font-medium">
                Page {pagination.page} of {pagination.total_pages}
              </div>
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 disabled:opacity-50 transition-colors"
                onClick={() => fetchAccounts(pagination.page + 1)}
                disabled={pagination.page === pagination.total_pages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
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
