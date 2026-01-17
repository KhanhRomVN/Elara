import { useEffect, useState, useRef } from 'react';
import { cn } from '../../shared/lib/utils';
import {
  Copy,
  Plus,
  Download,
  Trash2,
  Search,
  AlignEndVertical,
  Upload,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { AddAccountDialog } from './components/AddAccountDialog';
import { AccountAvatar } from './components/AccountAvatar';
import { providers } from '../../config/providers';

interface Account {
  id: string;
  provider_id: string;
  email: string;
  credential: string;
  status: 'Active' | 'Rate Limit' | 'Error';
  // New Stats
  totalRequests?: number;
  successfulRequests?: number;
  totalDuration?: number;
  tokensToday?: number;
  statsDate?: string;
  lastActive?: string;
}

type SortKey = 'successRate' | 'avgResponse' | 'tokensToday' | null;
type SortDirection = 'asc' | 'desc' | null;

export const Accounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, setServerRunning] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Filter & Sort State
  const [filterProvider, _setFilterProvider] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: null,
    direction: null,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const data = await window.api.accounts.getAll();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    // Auto-start server
    const startServer = async () => {
      // @ts-ignore
      const res = await window.api.server.start();
      if (res.success && res.port) {
        setServerRunning(true);
        setServerPort(res.port);
      } else {
        console.error('Failed to auto-start server:', res.error);
      }
    };
    startServer();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this account?')) return;
    try {
      // @ts-ignore
      await window.api.accounts.delete(id);
      fetchAccounts();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleImport = async () => {
    setShowDropdown(false);
    try {
      // @ts-ignore
      const result = await window.api.accounts.import();
      if (result.success) {
        fetchAccounts();
        alert(`Successfully imported: ${result.added} added, ${result.updated} updated.`);
      } else if (!result.canceled) {
        alert('Import failed: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to import:', error);
    }
  };

  const handleExport = async () => {
    setShowDropdown(false);
    try {
      // @ts-ignore
      const result = await window.api.accounts.export();
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCurrentPage(1);
    setSelectedAccounts(new Set());
  }, [searchQuery, filterProvider, sortConfig]);

  // Sorting Logic
  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        // New key, start with asc (Green for up/good? Logic request: Green (up), Red (down))
        // Usually Ascending = Green (Increasing), Descending = Red (Decreasing)
        // Wait, for SuccessRate: Higher is better. So maybe Descending is Green?
        // User request: "green (lên) và red (xuống)" -> Green (Up/Asc), Red (Down/Desc).
        // I will follow the user literally: Asc = Green, Desc = Red.
        return { key, direction: 'asc' };
      }
      // Cycle: asc -> desc -> null
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      if (prev.direction === 'desc') return { key: null, direction: null };
      return { key: null, direction: null };
    });
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return null;
    if (sortConfig.direction === 'asc') return <ArrowUp className="ml-1 h-3 w-3 text-green-500" />;
    if (sortConfig.direction === 'desc') return <ArrowDown className="ml-1 h-3 w-3 text-red-500" />;
    return null;
  };

  const getHeaderClass = (key: SortKey) => {
    if (sortConfig.key !== key) return 'text-muted-foreground';
    if (sortConfig.direction === 'asc') return 'text-green-500';
    if (sortConfig.direction === 'desc') return 'text-red-500';
    return 'text-muted-foreground';
  };

  const filteredAccounts = accounts
    .filter((acc) => {
      const matchSearch =
        acc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.provider_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchProvider =
        filterProvider === 'all' || acc.provider_id.toLowerCase() === filterProvider.toLowerCase();
      return matchSearch && matchProvider;
    })
    .sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;

      let valA = 0;
      let valB = 0;

      switch (sortConfig.key) {
        case 'successRate':
          valA =
            a.totalRequests && a.totalRequests > 0
              ? (a.successfulRequests || 0) / a.totalRequests
              : 0;
          valB =
            b.totalRequests && b.totalRequests > 0
              ? (b.successfulRequests || 0) / b.totalRequests
              : 0;
          break;
        case 'avgResponse':
          valA =
            a.totalRequests && a.totalRequests > 0 ? (a.totalDuration || 0) / a.totalRequests : 0;
          valB =
            b.totalRequests && b.totalRequests > 0 ? (b.totalDuration || 0) / b.totalRequests : 0;
          break;
        case 'tokensToday':
          valA = a.tokensToday || 0;
          valB = b.tokensToday || 0;
          break;
      }

      if (sortConfig.direction === 'asc') return valA - valB;
      return valB - valA;
    });

  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + itemsPerPage);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAccounts(newSelected);
  };

  const toggleAll = () => {
    if (selectedAccounts.size === paginatedAccounts.length && paginatedAccounts.length > 0) {
      // If all on current page are selected, deselect them
      const newSelected = new Set(selectedAccounts);
      paginatedAccounts.forEach((acc) => newSelected.delete(acc.id));
      setSelectedAccounts(newSelected);
    } else {
      // Select all on current page
      const newSelected = new Set(selectedAccounts);
      paginatedAccounts.forEach((acc) => newSelected.add(acc.id));
      setSelectedAccounts(newSelected);
    }
  };

  // Check if all visible items are selected
  const allVisibleSelected =
    paginatedAccounts.length > 0 && paginatedAccounts.every((acc) => selectedAccounts.has(acc.id));
  const someVisibleSelected = paginatedAccounts.some((acc) => selectedAccounts.has(acc.id));

  const copyApiUrl = (account: Account) => {
    const port = serverPort || 11434;
    const url = `http://localhost:${port}/v1/chat/completions?email=${encodeURIComponent(account.email)}&provider=${account.provider_id.toLowerCase()}`;
    navigator.clipboard.writeText(url);
  };

  const copyAccountJson = (account: Account) => {
    navigator.clipboard.writeText(JSON.stringify(account, null, 2));
  };

  return (
    <div className="space-y-4">
      <div className="mt-4">
        <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
        <p className="text-muted-foreground">Manage your connected accounts.</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Search Bar & Filter Toggle */}
          <div className="flex items-center gap-2 w-full max-w-lg">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex gap-2 items-center">
            {selectedAccounts.size > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-muted-foreground">
                  {selectedAccounts.size} selected
                </span>
                <button
                  onClick={() => {
                    if (confirm(`Delete ${selectedAccounts.size} accounts?`)) {
                      selectedAccounts.forEach((id) => handleDelete(id));
                      setSelectedAccounts(new Set());
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 text-destructive hover:text-destructive h-9 px-3"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
            <button
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
              >
                <AlignEndVertical className="h-4 w-4" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95 duration-200 z-50">
                  <div className="p-1">
                    <button
                      onClick={handleImport}
                      className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Import (JSON)
                    </button>
                    <button
                      onClick={handleExport}
                      className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
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

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 align-middle w-[40px]">
                  <input
                    type="checkbox"
                    className="appearance-none h-4 w-4 rounded border border-zinc-600 bg-zinc-900/50 checked:bg-blue-600 checked:border-blue-600 indeterminate:bg-blue-600 indeterminate:border-blue-600 cursor-pointer flex items-center justify-center after:text-white after:text-[10px] after:font-bold after:hidden checked:after:content-['✔'] checked:after:block indeterminate:after:content-['−'] indeterminate:after:block transition-all"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                  Account
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-nowrap">
                  Last Used
                </th>
                <th
                  className={cn(
                    'h-12 px-4 align-middle font-medium text-nowrap cursor-pointer hover:bg-muted/50 select-none',
                    getHeaderClass('successRate'),
                  )}
                  onClick={() => handleSort('successRate')}
                >
                  <div className="flex items-center">Success(%) {getSortIcon('successRate')}</div>
                </th>
                <th
                  className={cn(
                    'h-12 px-4 align-middle font-medium text-nowrap cursor-pointer hover:bg-muted/50 select-none',
                    getHeaderClass('avgResponse'),
                  )}
                  onClick={() => handleSort('avgResponse')}
                >
                  <div className="flex items-center">Avg Response {getSortIcon('avgResponse')}</div>
                </th>
                <th
                  className={cn(
                    'h-12 px-4 align-middle font-medium text-nowrap cursor-pointer hover:bg-muted/50 select-none',
                    getHeaderClass('tokensToday'),
                  )}
                  onClick={() => handleSort('tokensToday')}
                >
                  <div className="flex items-center">Tokens Today {getSortIcon('tokensToday')}</div>
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                  API Endpoint
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredAccounts.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="h-24 text-center text-muted-foreground">
                    {searchQuery
                      ? 'No accounts match your search.'
                      : 'No accounts found. Add one to get started.'}
                  </td>
                </tr>
              )}
              {paginatedAccounts.map((account) => {
                const providerConfig = providers.find((p) => p.id === account.provider_id);
                return (
                  <tr
                    key={account.id}
                    className={cn(
                      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
                      selectedAccounts.has(account.id) && 'bg-muted',
                    )}
                  >
                    <td className="p-4 align-middle">
                      <input
                        type="checkbox"
                        className="appearance-none h-4 w-4 rounded border border-zinc-600 bg-zinc-900/50 checked:bg-blue-600 checked:border-blue-600 cursor-pointer flex items-center justify-center after:text-white after:text-[10px] after:font-bold after:hidden checked:after:content-['✔'] checked:after:block transition-all"
                        checked={selectedAccounts.has(account.id)}
                        onChange={() => toggleSelection(account.id)}
                      />
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-3">
                        <AccountAvatar
                          email={account.email}
                          provider={account.provider_id}
                          className="w-8 h-8 text-[10px]"
                        />
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-sm">{account.email}</span>
                          <div
                            className={cn(
                              'inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-fit',
                              providerConfig?.color || 'bg-blue-500/10 text-blue-500',
                            )}
                          >
                            {providerConfig?.icon && (
                              <img
                                src={providerConfig.icon}
                                alt={account.provider_id}
                                className="w-3 h-3 mr-1"
                              />
                            )}
                            {account.provider_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle text-nowrap text-muted-foreground text-xs">
                      {account.lastActive ? new Date(account.lastActive).toLocaleString() : 'Never'}
                    </td>
                    <td className="p-4 align-middle text-nowrap">
                      {account.totalRequests && account.totalRequests > 0
                        ? `${(((account.successfulRequests || 0) / account.totalRequests) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </td>
                    <td className="p-4 align-middle text-nowrap">
                      {account.totalRequests && account.totalRequests > 0
                        ? `${((account.totalDuration || 0) / account.totalRequests).toFixed(0)}ms`
                        : 'N/A'}
                    </td>
                    <td className="p-4 align-middle font-mono text-nowrap">
                      {(account.tokensToday || 0).toLocaleString()}
                    </td>
                    <td className="p-4 align-middle group relative">
                      <code
                        className={cn(
                          'relative rounded  font-mono text-xs break-all block cursor-pointer hover:text-primary transition-colors text-muted-foreground',
                        )}
                        onClick={() => copyApiUrl(account)}
                        title={'Click to copy full URL'}
                      >
                        {`?email=${encodeURIComponent(account.email)}&provider=${account.provider_id.toLowerCase()}`}
                      </code>
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => copyAccountJson(account)}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                          title="Copy JSON"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 text-destructive hover:text-destructive h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredAccounts.length > 0 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to{' '}
              {Math.min(startIndex + itemsPerPage, filteredAccounts.length)} of{' '}
              {filteredAccounts.length} accounts
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 w-24"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <div className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 w-24"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <AddAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={fetchAccounts} />
    </div>
  );
};

export default Accounts;
