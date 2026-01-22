import { useState, useEffect } from 'react';
import {
  AlertCircle,
  X,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Key,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import googleIcon from '../../../assets/auth_icons/google.svg';

// Fallback providers just in case API fails
import { providers as staticProviders, fetchProviders } from '../../../config/providers';
import { AntigravityAddAccount } from './AntigravityAddAccount';

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  serverPort: number | null;
}

export function AddAccountDialog({
  open,
  onOpenChange,
  onSuccess,
  serverPort,
}: AddAccountDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetchingProviders, setFetchingProviders] = useState(false);
  const [provider, setProvider] = useState<string>('');
  const [error, setError] = useState('');

  // Confirmation State
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<any>(null);

  // Providers list state
  const [providers, setProviders] = useState<any[]>([]);

  const [loginMethod, setLoginMethod] = useState<string>('basic');

  useEffect(() => {
    if (open) {
      const fetchProvidersData = async () => {
        setFetchingProviders(true);
        try {
          const port = serverPort || 11434;
          const allProviders = await fetchProviders(port);

          setProviders(allProviders);

          // Set default provider if current selection is not enabled or not in list
          const currentP = allProviders.find((p: any) => p.provider_id === provider);
          if (!currentP || !currentP.is_enabled) {
            const firstEnabled = allProviders.find((p: any) => p.is_enabled);
            if (firstEnabled) {
              setProvider(firstEnabled.provider_id);
            }
          }
        } catch (e) {
          console.error('[AddAccountDialog] Error fetching providers:', e);
          setProviders(staticProviders);
        } finally {
          setFetchingProviders(false);
        }
      };

      fetchProvidersData();

      // Reset other states
      setLoading(false);
      setError('');
      setShowConfirm(false);
      setPendingAccount(null);
      setLoginMethod('basic');
    }
  }, [open, serverPort]);

  const saveToBackend = async (account: any) => {
    if (!serverPort || !account) return;
    try {
      // Ensure we have a UUID
      const finalId = account.id || crypto.randomUUID();

      console.log('[AddAccountDialog] Syncing account to backend...', { ...account, id: finalId });

      const res = await fetch(`http://localhost:${serverPort}/v1/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: finalId,
          provider_id: account.provider_id,
          email: account.email,
          credential: account.credential,
        }),
      });
      const data = await res.json();
      console.log('[AddAccountDialog] Backend sync result:', data);
    } catch (e) {
      console.error('[AddAccountDialog] Failed to sync to backend:', e);
    }
  };

  const onConfirmAccount = async () => {
    if (!pendingAccount) return;
    setLoading(true);
    try {
      // Call dedicated create endpoint
      const result = await window.api.accounts.create(pendingAccount);
      if (result.success) {
        await saveToBackend(pendingAccount);
        onOpenChange(false);
        onSuccess();
      } else {
        setError(result.error || 'Failed to save account');
      }
    } catch (e: any) {
      setError(e.message || 'Error saving account');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AddAccountDialog] handleLogin called for provider:', provider);

    const hasOAuth = selectedProviderData?.auth_methods?.includes('oauth');
    if (hasOAuth) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await window.api.accounts.login(provider, { method: loginMethod });

      if (result.success) {
        console.log('[AddAccountDialog] Login success for', provider, 'Result:', result);

        // Always show confirmation before saving
        setPendingAccount(result.account);
        setShowConfirm(true);
      } else {
        console.error('[AddAccountDialog] Login failed:', result.error);
        setError(result.error || 'Login failed or was cancelled');
      }
    } catch (err) {
      setError('An unexpected error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const selectedProviderData = providers.find((p) => p.provider_id === provider);

  // Render Confirmation View
  if (showConfirm && pendingAccount) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-xl border bg-card text-card-foreground shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col space-y-1.5 p-6 pb-2">
            <h3 className="font-semibold leading-none tracking-tight">Confirm Account</h3>
            <p className="text-sm text-muted-foreground">
              Please review the captured account details.
            </p>
          </div>

          <div className="p-6 pt-4 space-y-4">
            {/* Email / Identifier Input (Read-only) */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Email / Identifier</label>
              <div className="relative">
                <input
                  type="text"
                  value={pendingAccount.email}
                  readOnly
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed opacity-100 dark:text-foreground"
                />
                <div className="absolute right-3 top-2.5">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <p className="text-[0.8rem] text-muted-foreground">
                This is the email we captured from the login session.
              </p>
            </div>

            {/* Credential Input (Read-only, Masked) */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Credential / Token</label>
              <div className="relative">
                <input
                  type="text"
                  value={
                    pendingAccount.credential
                      ? `${pendingAccount.credential.substring(0, 10)}...${pendingAccount.credential.substring(pendingAccount.credential.length - 5)}`
                      : 'N/A'
                  }
                  readOnly
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-mono ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed opacity-100 dark:text-foreground"
                />
                <div className="absolute right-3 top-2.5">
                  <Key className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-[0.8rem] text-muted-foreground">
                Your secure access token (partially masked).
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setPendingAccount(null);
                }}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmAccount}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2"
              >
                {loading ? 'Adding...' : 'Confirm & Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full rounded-xl border bg-card text-card-foreground shadow-lg animate-in fade-in zoom-in-95 duration-200 max-w-4xl">
        <div className="flex flex-col space-y-1.5 p-6 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold leading-none tracking-tight">Add New Account</h3>
            <button
              onClick={() => {
                onOpenChange(false);
              }}
              className="rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Select a provider to connect your account.
          </p>
        </div>

        <div className="p-6 pt-2 h-[600px] flex flex-col">
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
              <div className="flex gap-2 items-center text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                Error
              </div>
              <div className="text-sm mt-1">{error}</div>
            </div>
          )}

          {fetchingProviders ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading providers...</span>
            </div>
          ) : (
            <div className="flex-1 flex gap-4 overflow-hidden">
              {/* Providers List - Left Side */}
              <div className="w-1/3 overflow-y-auto pr-2 border-r">
                <div className="space-y-2">
                  {providers.map((p) => (
                    <div
                      key={p.provider_id}
                      onClick={() => p.is_enabled !== false && setProvider(p.provider_id)}
                      className={cn(
                        'p-3 transition-all rounded-lg border mb-2',
                        p.is_enabled === false
                          ? 'opacity-50 grayscale cursor-not-allowed bg-muted/30 border-dashed'
                          : 'cursor-pointer hover:bg-accent hover:text-accent-foreground',
                        provider === p.provider_id && p.is_enabled !== false
                          ? 'bg-accent/50 border-l-4 border-l-primary rounded-r-lg ring-1 ring-primary/20'
                          : 'bg-card',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md overflow-hidden bg-background border flex items-center justify-center p-1 relative shrink-0">
                          <img
                            src={p.icon}
                            alt={p.provider_name}
                            className="w-full h-full object-contain"
                          />
                          {p.is_enabled === false && (
                            <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">
                                OFF
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{p.provider_name}</h4>
                            {p.is_enabled === false && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border font-normal">
                                Coming Soon
                              </span>
                            )}
                          </div>

                          {/* Badges Section */}
                          <div className="flex items-center gap-1.5 mt-1">
                            {p.auth_method?.map((method: string) => {
                              // Special interactive badges for providers with multiple methods
                              if (p.auth_methods && p.auth_methods.length > 1) {
                                if (method === 'basic') {
                                  return (
                                    <div
                                      key="basic"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProvider(p.provider_id);
                                        setLoginMethod('basic');
                                      }}
                                      className={cn(
                                        'flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium cursor-pointer transition-colors',
                                        loginMethod === 'basic' && provider === p.provider_id
                                          ? 'bg-primary/20 text-primary border-primary/30'
                                          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                                      )}
                                    >
                                      <Mail className="w-3 h-3" />
                                      <span>Basic</span>
                                    </div>
                                  );
                                }
                                if (method === 'google') {
                                  return (
                                    <div
                                      key="google"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProvider(p.provider_id);
                                        setLoginMethod('google');
                                      }}
                                      className={cn(
                                        'flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium cursor-pointer transition-colors',
                                        loginMethod === 'google' && provider === p.provider_id
                                          ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                                          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                                      )}
                                    >
                                      <img src={googleIcon} alt="Google" className="w-3 h-3" />
                                      <span>Google</span>
                                    </div>
                                  );
                                }
                              }

                              // Static badges for other providers
                              if (method === 'basic') {
                                return (
                                  <div
                                    key="basic-static"
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium bg-muted/50 text-muted-foreground border-border"
                                  >
                                    <Mail className="w-3 h-3" />
                                    <span>Basic</span>
                                  </div>
                                );
                              }
                              if (method === 'google') {
                                return (
                                  <div
                                    key="google-static"
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium bg-muted/50 text-muted-foreground border-border"
                                  >
                                    <img src={googleIcon} alt="Google" className="w-3 h-3" />
                                    <span>Google</span>
                                  </div>
                                );
                              }

                              return null;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 pl-2 overflow-y-auto min-h-0">
                {selectedProviderData?.provider_id === 'antigravity' ? (
                  <AntigravityAddAccount
                    onAccountPending={(acc) => {
                      setPendingAccount(acc);
                      setShowConfirm(true);
                    }}
                    onError={setError}
                    serverPort={serverPort}
                  />
                ) : selectedProviderData?.auth_methods?.includes('oauth') ||
                  selectedProviderData?.auth_methods?.includes('token') ? (
                  <div className="flex flex-col h-full items-center justify-center text-center p-8">
                    <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground/20 mb-4" />
                    <p className="text-muted-foreground">Select a provider to continue</p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full items-center justify-center text-center space-y-6">
                    <div
                      className={cn(
                        'p-4 rounded-full bg-opacity-20',
                        selectedProviderData?.color || 'bg-muted',
                      )}
                    >
                      <img src={selectedProviderData?.icon} className="w-12 h-12" alt={provider} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">
                        Login to {selectedProviderData?.provider_name}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        {loginMethod === 'google'
                          ? `We will utilize the Google Login flow for ${selectedProviderData?.provider_name}.`
                          : selectedProviderData?.loginMethod === 'Direct'
                            ? 'We will attempt to log you in automatically via the browser.'
                            : 'A secure browser window will open for you to log in.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleLogin(e as any)}
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2 w-full max-w-xs"
                    >
                      {loading ? 'Waiting...' : `Login with ${provider}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
