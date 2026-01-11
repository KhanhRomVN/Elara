import { useEffect, useState } from 'react';

import { useRef } from 'react';
import { cn } from '../../shared/lib/utils';
import { Copy, Plus, Download, Trash2, Search, FlipVertical, Upload } from 'lucide-react';
import { AddAccountDialog } from './components/AddAccountDialog';

interface Account {
  id: string;
  provider: 'Claude' | 'DeepSeek';
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
  name?: string;
  picture?: string;
}

export const Accounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, setServerRunning] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const data = await window.api.accounts.getAll();
      console.log('📧 Raw accounts data:', data);
      console.log(
        '📧 Email values:',
        data.map((acc) => ({ id: acc.id, email: acc.email })),
      );
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

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (acc.name && acc.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const copyApiUrl = (account: Account) => {
    const port = serverPort || 11434;
    const url = `http://localhost:${port}/v1/chat/completions?email=${encodeURIComponent(account.email)}&provider=${account.provider.toLowerCase()}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="space-y-4">
      <div className="mt-4">
        <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
        <p className="text-muted-foreground">Manage your connected accounts.</p>
      </div>
      <div className="flex items-center justify-between gap-4">
        {/* Left: Search Bar */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Right: Actions */}
        <div className="flex gap-2 items-center">
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
              <FlipVertical className="h-4 w-4" />
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

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-nowrap">
                  Last Used
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-nowrap">
                  Success(%)
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-nowrap">
                  Avg Response
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-nowrap">
                  Tokens Today
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
                  <td colSpan={7} className="h-24 text-center text-muted-foreground">
                    {searchQuery
                      ? 'No accounts match your search.'
                      : 'No accounts found. Add one to get started.'}
                  </td>
                </tr>
              )}
              {filteredAccounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                >
                  <td className="p-4 align-middle">
                    <div className="flex items-center gap-3">
                      {account.picture && (
                        <img
                          src={account.picture}
                          alt={account.name || account.email}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {account.name && (
                            <span className="font-medium text-sm">{account.name}</span>
                          )}
                          <div
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                              account.provider === 'Claude'
                                ? 'bg-orange-500/10 text-orange-500'
                                : 'bg-blue-500/10 text-blue-500',
                            )}
                          >
                            {account.provider}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{account.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 align-middle text-nowrap">
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
                        'relative rounded  font-mono text-xs break-all block cursor-pointer hover:text-primary transition-colors',
                      )}
                      onClick={() => copyApiUrl(account)}
                      title={'Click to copy full URL'}
                    >
                      {`?email=${encodeURIComponent(account.email)}&provider=${account.provider.toLowerCase()}`}
                    </code>
                  </td>
                  <td className="p-4 align-middle text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => copyApiUrl(account)}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                        title="Copy API URL"
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={fetchAccounts} />
    </div>
  );
};

export default Accounts;
