import { useState, useEffect } from 'react';
import { AlertCircle, X, RefreshCw, Key, Mail, ShieldCheck } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { getApiBaseUrl } from '../../../utils/apiUrl';
import googleIcon from '../../../assets/auth_icons/google.svg';
import appleIcon from '../../../assets/auth_icons/apple.svg';
import githubIcon from '../../../assets/auth_icons/github.svg';

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

      const baseUrl = getApiBaseUrl(serverPort);
      const res = await fetch(`${baseUrl}/v1/accounts`, {
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
        <div className="w-full max-w-md rounded-xl border bg-card/50 backdrop-blur-xl text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex flex-col space-y-1.5 p-6 pb-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold text-lg tracking-tight">Confirm Account</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Please review the captured account details.
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Email / Identifier Input (Read-only) */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-muted-foreground tracking-wide">
                Email / Identifier
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={pendingAccount.email}
                  readOnly
                  className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed opacity-100 text-foreground font-medium"
                />
                <div className="absolute right-3 top-2.5">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <p className="text-[0.75rem] text-muted-foreground">
                This is the email we captured from the login session.
              </p>
            </div>

            {/* Credential Input (Read-only, Masked) */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-muted-foreground tracking-wide">
                Credential / Token
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={
                    pendingAccount.credential
                      ? `${pendingAccount.credential.substring(0, 10)}...${pendingAccount.credential.substring(pendingAccount.credential.length - 5)}`
                      : 'N/A'
                  }
                  readOnly
                  className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 pr-10 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed opacity-100 text-foreground"
                />
                <div className="absolute right-3 top-2.5">
                  <Key className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-[0.75rem] text-muted-foreground">
                Your secure access token (partially masked).
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setPendingAccount(null);
                }}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmAccount}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-6"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Confirm & Add'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full rounded-xl border bg-card/50 backdrop-blur-xl text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col space-y-1.5 p-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-semibold text-lg tracking-tight">Add New Account</h3>
              </div>
            </div>
            <button
              onClick={() => {
                onOpenChange(false);
              }}
              className="rounded-md p-2 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        <div className="h-[600px] flex flex-col">
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3.5 text-destructive animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2 items-center text-sm font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Error</span>
              </div>
              <div className="text-sm mt-1 ml-6">{error}</div>
            </div>
          )}

          {fetchingProviders ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading providers...</span>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Providers List - Left Side */}
              <div className="w-80 overflow-y-auto border-r border-border/50 custom-scrollbar bg-card/10">
                <div className="space-y-0 divide-y divide-border/20">
                  {providers.map((p) => (
                    <div
                      key={p.provider_id}
                      onClick={() => p.is_enabled !== false && setProvider(p.provider_id)}
                      className={cn(
                        'px-4 py-3 transition-all cursor-pointer group relative',
                        p.is_enabled === false
                          ? 'opacity-50 grayscale cursor-not-allowed bg-muted/5'
                          : 'hover:bg-accent/40',
                        provider === p.provider_id && p.is_enabled !== false
                          ? 'bg-primary/5 border-l-2 border-primary'
                          : 'border-l-2 border-transparent',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md overflow-hidden flex items-center justify-center p-0 relative shrink-0 bg-background/50 border border-border/50">
                          <img
                            src={p.icon}
                            alt={p.provider_name}
                            className="w-full h-full object-contain p-1"
                          />
                          {p.is_enabled === false && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-tighter">
                                OFF
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm truncate">{p.provider_name}</h4>
                            {p.is_enabled === false && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border font-medium uppercase tracking-wide">
                                Soon
                              </span>
                            )}
                            {p.connection_mode === 'headless_browser' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium uppercase tracking-wide border border-orange-200 dark:border-orange-900/50">
                                Browser
                              </span>
                            )}
                          </div>

                          {/* Auth Methods Badges */}
                          <div className="flex items-center gap-1.5 mt-2">
                            {(p.auth_methods || p.auth_method || []).map((method: string) => {
                              const isSelected =
                                loginMethod === method && provider === p.provider_id;
                              const isInteractive = (p.auth_methods || []).length > 1;

                              let icon: JSX.Element | null = null;
                              const methodStr = String(method);
                              let label = methodStr.charAt(0).toUpperCase() + methodStr.slice(1);
                              let customStyle = 'bg-input-background text-muted-foreground';

                              if (method === 'basic') {
                                icon = <Mail className="w-3 h-3" />;
                                if (isSelected) customStyle = 'bg-input-background text-primary';
                              } else if (method === 'google') {
                                icon = <img src={googleIcon} alt="Google" className="w-3 h-3" />;
                                if (isSelected)
                                  customStyle =
                                    'bg-input-background text-blue-600 dark:text-blue-400';
                              } else if (method === 'apple') {
                                icon = <img src={appleIcon} alt="Apple" className="w-3 h-3" />;
                                if (isSelected) customStyle = 'bg-input-background text-foreground';
                              } else if (method === 'github') {
                                icon = <img src={githubIcon} alt="GitHub" className="w-3 h-3" />;
                                if (isSelected) customStyle = 'bg-input-background text-foreground';
                              }

                              return (
                                <div
                                  key={method}
                                  onClick={
                                    isInteractive
                                      ? (e) => {
                                          e.stopPropagation();
                                          setProvider(p.provider_id);
                                          setLoginMethod(method);
                                        }
                                      : undefined
                                  }
                                  className={cn(
                                    'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                                    isInteractive && 'cursor-pointer hover:bg-accent/50',
                                    customStyle,
                                  )}
                                >
                                  {icon}
                                  <span>{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
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
                    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                      <RefreshCw className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">Select a provider to continue</p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full items-center justify-center text-center space-y-6 p-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/20">
                      <img src={selectedProviderData?.icon} className="w-12 h-12" alt={provider} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">
                        Login to {selectedProviderData?.provider_name}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
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
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:scale-105 active:scale-100 h-11 px-8 w-full max-w-xs"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Waiting...
                        </>
                      ) : (
                        `Login with ${selectedProviderData?.provider_name}`
                      )}
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
