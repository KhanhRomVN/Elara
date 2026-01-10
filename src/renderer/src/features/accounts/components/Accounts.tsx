import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../shared/lib/utils';
import { Copy, RefreshCw, Plus, Download, Trash2, Wifi, WifiOff } from 'lucide-react';
import { AddAccountDialog } from './AddAccountDialog';

interface Account {
  id: string;
  provider: 'Claude' | 'DeepSeek';
  email: string;
  credential: string;
  status: 'Active' | 'Rate Limit' | 'Error';
  usage: string;
  lastActive?: string;
  name?: string;
  picture?: string;
}

export const Accounts = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);

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

  const handleExport = async () => {
    try {
      // @ts-ignore
      await window.api.accounts.export();
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const toggleServer = async () => {
    if (serverRunning) {
      // @ts-ignore
      const res = await window.api.server.stop();
      if (res.success) {
        setServerRunning(false);
        setServerPort(null);
      }
    } else {
      // @ts-ignore
      const res = await window.api.server.start();
      if (res.success && res.port) {
        setServerRunning(true);
        setServerPort(res.port);
      } else {
        alert('Failed to start server: ' + res.error);
      }
    }
  };

  const copyApiUrl = (account: Account) => {
    if (serverRunning && serverPort) {
      const url = `http://localhost:${serverPort}/v1/chat/completions?email=${encodeURIComponent(account.email)}&provider=${account.provider.toLowerCase()}`;
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Accounts</h2>
          <p className="text-muted-foreground mt-1">
            Manage your AI provider accounts regarding local proxy server.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleServer}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 border shadow-sm',
              serverRunning
                ? 'bg-green-100 text-green-900 border-green-200 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                : 'bg-background hover:bg-accent hover:text-accent-foreground border-input',
            )}
          >
            {serverRunning ? (
              <Wifi className="mr-2 h-4 w-4" />
            ) : (
              <WifiOff className="mr-2 h-4 w-4" />
            )}
            {serverRunning ? `Backend On (: ${serverPort})` : 'Backend Off'}
          </button>

          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                  API Endpoint
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                  Today's Tokens
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {accounts.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="h-24 text-center text-muted-foreground">
                    No accounts found. Add one to get started.
                  </td>
                </tr>
              )}
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  onClick={() => navigate(`/accounts/${account.id}`)}
                  className="border-b transition-colors hover:bg-muted/50 cursor-pointer data-[state=selected]:bg-muted"
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
                  <td className="p-4 align-middle group relative">
                    <code
                      className={cn(
                        'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs break-all selection:bg-primary/20 block',
                        serverRunning &&
                          'cursor-pointer hover:bg-muted/80 hover:text-primary transition-colors',
                      )}
                      onClick={() => copyApiUrl(account)}
                      title={serverRunning ? 'Click to copy full URL' : 'Start backend first'}
                    >
                      {serverRunning
                        ? `?email=${encodeURIComponent(account.email)}&provider=${account.provider.toLowerCase()}`
                        : 'Start Backend to see'}
                    </code>
                  </td>
                  <td className="p-4 align-middle font-mono">{account.usage}</td>
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
