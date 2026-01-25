import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../shared/lib/utils';
import {
  Copy,
  Plus,
  Download,
  Trash2,
  MoreHorizontal,
  Search,
  AlignEndVertical,
  Upload,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AddAccountDialog } from './components/AddAccountDialog';
import { fetchProviders } from '../../config/providers';
import { getApiBaseUrl } from '../../utils/apiUrl';
// import { AccountAvatar } from './components/AccountAvatar';

interface Account {
  id: string;
  provider_id: string;
  email: string;
  credential: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const Accounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [filterProvider] = useState<string>('all');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const navigate = useNavigate();

  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    total_pages: 1,
  });

  const [providerConfigs, setProviderConfigs] = useState<any[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (
        activeDropdownId &&
        !(event.target as Element).closest('.row-dropdown-trigger') &&
        !(event.target as Element).closest('.row-dropdown-menu')
      ) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdownId]);

  const fetchAccounts = async (page = 1, limit = 10) => {
    if (!serverPort) return;
    setLoading(true);
    try {
      // Also fetch providers to ensure we have favicons/config
      const pConfigs = await fetchProviders(serverPort);
      setProviderConfigs(pConfigs);

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (searchQuery) queryParams.append('email', searchQuery);
      if (filterProvider !== 'all') queryParams.append('provider_id', filterProvider);

      const baseUrl = getApiBaseUrl(serverPort);
      const response = await fetch(`${baseUrl}/v1/accounts?${queryParams.toString()}`);
      const result = await response.json();
      console.log('[Accounts] Fetched:', result);

      if (result.success) {
        setAccounts(result.data.accounts);
        setPagination(result.data.pagination);
      } else {
        console.error('Failed to fetch accounts:', result.message);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const startServer = async () => {
      try {
        const res = await window.api.server.start();
        console.log('[Accounts] Server started:', res);
        if (res.success && res.port) {
          setServerPort(res.port);
        } else {
          console.error('Failed to auto-start server:', res.error);
        }
      } catch (e) {
        console.error('Error starting server:', e);
      }
    };
    startServer();
  }, []);

  useEffect(() => {
    if (serverPort) {
      fetchAccounts(1, pagination.limit);
    }
  }, [serverPort, searchQuery, filterProvider]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      fetchAccounts(newPage, pagination.limit);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this account?')) return;
    try {
      if (serverPort) {
        // Use API
        const baseUrl = getApiBaseUrl(serverPort);
        const response = await fetch(`${baseUrl}/v1/accounts/${id}`, {
          method: 'DELETE',
        });
        const result = await response.json();

        if (result.success) {
          fetchAccounts(pagination.page, pagination.limit);
        } else {
          console.error('Failed to delete:', result.message);
          alert('Failed to delete account: ' + result.message);
        }
      } else {
        // Fallback or error if server not connected (should not happen if we listed accounts)
        await window.api.accounts.delete(id);
        fetchAccounts(pagination.page, pagination.limit);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete account');
    }
  };

  const handleImport = async () => {
    setShowDropdown(false);
    try {
      const result = await window.api.accounts.import();
      if (result.success) {
        fetchAccounts(pagination.page, pagination.limit);
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
      const result = await window.api.accounts.export();
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

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
    if (selectedAccounts.size === accounts.length && accounts.length > 0) {
      const newSelected = new Set(selectedAccounts);
      accounts.forEach((acc) => newSelected.delete(acc.id));
      setSelectedAccounts(newSelected);
    } else {
      const newSelected = new Set(selectedAccounts);
      accounts.forEach((acc) => newSelected.add(acc.id));
      setSelectedAccounts(newSelected);
    }
  };

  const allVisibleSelected =
    accounts.length > 0 && accounts.every((acc) => selectedAccounts.has(acc.id));
  const someVisibleSelected = accounts.some((acc) => selectedAccounts.has(acc.id));

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
          <div className="flex items-center gap-2 w-full max-w-lg">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

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
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-destructive/10 text-destructive hover:text-destructive h-9 px-3"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
            <button
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 text-white"
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
                      onClick={handleImport}
                      className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Import (JSON)
                    </button>
                    <button
                      onClick={handleExport}
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

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 align-middle w-[40px]">
                  <input
                    type="checkbox"
                    className="appearance-none h-4 w-4 rounded border border-zinc-600 bg-zinc-900/50 checked:bg-blue-600 checked:border-blue-600 cursor-pointer flex items-center justify-center after:text-white after:text-[10px] after:font-bold after:hidden checked:after:content-['✔'] checked:after:block transition-all"
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
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {accounts.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="h-24 text-center text-muted-foreground">
                    {searchQuery
                      ? 'No accounts match your search.'
                      : 'No accounts found. Add one to get started.'}
                  </td>
                </tr>
              )}
              {accounts.map((account) => {
                const providerConfig = providerConfigs.find(
                  (p) => p.provider_id.toLowerCase() === account.provider_id.toLowerCase(),
                );
                const isActive = providerConfig ? providerConfig.is_enabled : true;

                return (
                  <tr
                    key={account.id}
                    className={cn(
                      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
                      selectedAccounts.has(account.id) && 'bg-muted',
                      !isActive && 'opacity-50 grayscale',
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
                        {/* New Provider Badge */}
                        <div className="flex items-center gap-2">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center p-1.5">
                            {providerConfig?.icon ? (
                              <img
                                src={providerConfig.icon}
                                alt={providerConfig.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="text-[10px]">{account.provider_id.slice(0, 2)}</span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{account.email}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground font-medium">
                                {providerConfig?.name || account.provider_id}
                              </span>
                              {!isActive && (
                                <span className="text-[10px] border px-1 rounded bg-muted text-muted-foreground">
                                  Disabled
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => copyAccountJson(account)}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8"
                          title="Copy JSON"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveDropdownId(
                                activeDropdownId === account.id ? null : account.id,
                              )
                            }
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8 row-dropdown-trigger"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {activeDropdownId === account.id && (
                            <div className="absolute right-0 top-full mt-1 w-56 rounded-md border bg-popover text-popover-foreground shadow-md z-50 row-dropdown-menu">
                              <div className="p-1">
                                <button
                                  onClick={() => {
                                    navigate('/playground', {
                                      state: {
                                        providerId: account.provider_id,
                                        accountId: account.id,
                                      },
                                    });
                                  }}
                                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                                >
                                  Open in Playground
                                </button>
                                <button
                                  onClick={() => handleDelete(account.id)}
                                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-destructive/10 hover:text-destructive text-destructive"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Footer */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
              accounts
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 disabled:opacity-50"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
              <div className="text-sm font-medium">
                Page {pagination.page} of {pagination.total_pages}
              </div>
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 disabled:opacity-50"
                onClick={() => handlePageChange(pagination.page + 1)}
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
        onSuccess={() => fetchAccounts(pagination.page, pagination.limit)}
        serverPort={serverPort}
      />
    </div>
  );
};

export default Accounts;
