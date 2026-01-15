import { useState, useEffect } from 'react';
import { AlertCircle, X, Copy, Check, ExternalLink, RefreshCw, Key } from 'lucide-react';

import claudeIcon from '../../../assets/provider_icons/claude.svg';
import deepseekIcon from '../../../assets/provider_icons/deepseek.svg';

import mistralIcon from '../../../assets/provider_icons/mistral.svg';
import kimiIcon from '../../../assets/provider_icons/kimi.svg';
import qwenIcon from '../../../assets/provider_icons/qwen.svg';
import cohereIcon from '../../../assets/provider_icons/cohere.svg';
import perplexityIcon from '../../../assets/provider_icons/perplexity.svg';
import groqIcon from '../../../assets/provider_icons/groq.svg';
import geminiIcon from '../../../assets/provider_icons/gemini.svg';
import antigravityIcon from '../../../assets/provider_icons/antigravity.svg';

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddAccountDialog({ open, onOpenChange, onSuccess }: AddAccountDialogProps) {
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string>('Claude');
  const [error, setError] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [actualEmail, setActualEmail] = useState('');
  const [actualUsername, setActualUsername] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);

  // Antigravity Specific State
  const [agTab, setAgTab] = useState<'oauth' | 'token'>('oauth');
  const [agOAuthUrl, setAgOAuthUrl] = useState('');
  const [agWaiting, setAgWaiting] = useState(false);
  const [agToken, setAgToken] = useState('');

  // Reset state when closing/opening
  useEffect(() => {
    if (open) {
      setLoading(false);
      setError('');
      setShowEmailInput(false);
      setAgOAuthUrl('');
      setAgWaiting(false);
      setAgToken('');
    }
  }, [open, provider]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AddAccountDialog] handleLogin called for provider:', provider);

    if (provider === 'Antigravity') {
      // Handled separately in render via specialized UI, but if form submitted:
      return;
    }

    setLoading(true);
    setError('');

    try {
      // @ts-ignore
      const result = await window.api.accounts.login(provider);

      if (result.success) {
        // Show email input if email is masked or missing
        const needsManualEmail =
          result.account?.email?.includes('***') ||
          result.account?.email === 'deepseek@user.com' ||
          result.account?.email === 'kimi@user.com' ||
          result.account?.email === 'qwen@user.com' ||
          result.account?.email === 'cohere@user.com' ||
          result.account?.email === 'groq@user.com' ||
          result.account?.email === 'gemini@user.com' ||
          result.account?.email === 'perplexity@user.com' ||
          !result.account?.email;

        if (needsManualEmail && result.account) {
          setAccountId(result.account.id);
          setShowEmailInput(true);
          setLoading(false);
        } else {
          onOpenChange(false);
          onSuccess();
        }
      } else {
        setError(result.error || 'Login failed or was cancelled');
      }
    } catch (err) {
      setError('An unexpected error occurred during login');
    } finally {
      if (!showEmailInput) {
        setLoading(false);
      }
    }
  };

  const handleAgStartOAuth = async () => {
    setLoading(true);
    setError('');
    setAgWaiting(true);
    try {
      // @ts-ignore
      const prep = await window.api.accounts.antigravity.prepareOAuth();
      if (!prep.success) {
        throw new Error(prep.error);
      }
      setAgOAuthUrl(prep.url);

      // Auto-open removed. User must copy/open link manually.
      // window.open(prep.url, '_blank');

      // Start waiting for completion
      // @ts-ignore
      const result = await window.api.accounts.antigravity.completeOAuth();
      if (result.success) {
        onOpenChange(false);
        onSuccess();
      } else {
        setError(result.error || 'OAuth failed');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start OAuth');
    } finally {
      setLoading(false);
      setAgWaiting(false);
    }
  };

  const handleAgTokenParams = async () => {
    if (!agToken.trim()) {
      setError('Please enter a refresh token');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // @ts-ignore
      const result = await window.api.accounts.antigravity.addByToken(agToken.trim());
      if (result.success) {
        onOpenChange(false);
        onSuccess();
      } else {
        setError(result.error || 'Failed to add account');
      }
    } catch (e: any) {
      setError(e.message || 'Error adding account');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualEmail.trim() || !accountId) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const updates: any = { email: actualEmail.trim() };
      if (actualUsername.trim()) {
        updates.name = actualUsername.trim();
      }

      // @ts-ignore
      await window.api.accounts.update(accountId, updates);
      setShowEmailInput(false);
      setActualEmail('');
      setActualUsername('');
      setAccountId(null);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError('Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const isPerplexity = provider === 'Perplexity';

  const providers = [
    {
      id: 'Claude',
      name: 'Claude',
      description: 'Smartest Model',
      icon: claudeIcon,
      color: 'bg-orange-500/10 text-orange-500 border-orange-200/20',
      loginMethod: 'Direct / Google',
      browserType: 'Electron Window',
    },
    {
      id: 'DeepSeek',
      name: 'DeepSeek',
      description: 'Open Weight Model',
      icon: deepseekIcon,
      color: 'bg-blue-500/10 text-blue-500 border-blue-200/20',
      loginMethod: 'Direct / Google',
      browserType: 'Electron Window',
    },

    {
      id: 'Mistral',
      name: 'Mistral',
      description: 'European AI',
      icon: mistralIcon,
      color: 'bg-yellow-500/10 text-yellow-500 border-yellow-200/20',
      loginMethod: 'Direct / Google',
      browserType: 'Electron Window',
    },
    {
      id: 'Kimi',
      name: 'Kimi',
      description: 'Long Context',
      icon: kimiIcon,
      color: 'bg-indigo-500/10 text-indigo-500 border-indigo-200/20',
      loginMethod: 'Mobile / OTP',
      browserType: 'Electron Window',
    },
    {
      id: 'Qwen',
      name: 'Qwen',
      description: 'Alibaba Cloud',
      icon: qwenIcon,
      color: 'bg-purple-500/10 text-purple-500 border-purple-200/20',
      loginMethod: 'Direct',
      browserType: 'Electron Window',
    },
    {
      id: 'Cohere',
      name: 'Cohere',
      description: 'Enterprise AI',
      icon: cohereIcon,
      color: 'bg-teal-500/10 text-teal-500 border-teal-200/20',
      loginMethod: 'Direct',
      browserType: 'Electron Window',
    },
    {
      id: 'Perplexity',
      name: 'Perplexity',
      description: 'Search Engine',
      icon: perplexityIcon,
      color: 'bg-cyan-500/10 text-cyan-500 border-cyan-200/20',
      loginMethod: 'Google',
      browserType: 'Real Browser',
    },
    {
      id: 'Groq',
      name: 'Groq',
      description: 'Fastest Inference',
      icon: groqIcon,
      color: 'bg-orange-600/10 text-orange-600 border-orange-300/20',
      loginMethod: 'Google / Email',
      browserType: 'Real Browser',
    },
    {
      id: 'Gemini',
      name: 'Gemini',
      description: 'Google Deepmind',
      icon: geminiIcon,
      color: 'bg-sky-500/10 text-sky-500 border-sky-200/20',
      loginMethod: 'Google',
      browserType: 'Real Browser',
    },
    {
      id: 'Antigravity',
      name: 'Antigravity',
      description: 'Unified AI Gateway',
      icon: antigravityIcon,
      color: 'bg-purple-500/10 text-purple-500 border-purple-200/20',
      loginMethod: 'Google OAuth',
      browserType: 'Auth Server',
    },
  ];

  const selectedProviderData = providers.find((p) => p.id === provider);

  // Render Antigravity Tab Content
  const renderAntigravityContent = () => {
    return (
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${agTab === 'oauth' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setAgTab('oauth')}
          >
            Google OAuth
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${agTab === 'token' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setAgTab('token')}
          >
            Refresh Token
          </button>
        </div>

        {/* Tab Panels */}
        <div className="flex-1">
          {agTab === 'oauth' && (
            <div className="flex flex-col items-center justify-center space-y-6 py-4">
              <div className="text-center space-y-2">
                <h4 className="font-medium">Sign in with Google</h4>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Authenticate securely via Google to access Antigravity services. A local server
                  will start to handle the callback.
                </p>
              </div>

              {!agOAuthUrl ? (
                <button
                  type="button"
                  onClick={handleAgStartOAuth}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {loading ? 'Starting...' : 'Generate Login URL'}
                </button>
              ) : (
                <div className="w-full space-y-4">
                  <div className="p-3 bg-muted rounded-md border text-sm text-center">
                    {agWaiting ? (
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                        <span>Waiting for you to complete login in the browser...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Login setup complete!</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Login URL (Copy and open in browser)
                    </label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={agOAuthUrl}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(agOAuthUrl)}
                        className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        title="Copy URL"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <a
                        href={agOAuthUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        title="Open in Browser"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {agTab === 'token' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="ref-token" className="text-sm font-medium">
                  Refresh Token
                </label>
                <textarea
                  id="ref-token"
                  value={agToken}
                  onChange={(e) => setAgToken(e.target.value)}
                  placeholder="Paste your Google OAuth Refresh Token here (starts with '1//...')"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAgTokenParams}
                  disabled={loading || !agToken.trim()}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2"
                >
                  {loading ? 'Verifying...' : 'Add Account'}
                  {!loading && <Key className="ml-2 h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className={`w-full rounded-xl border bg-card text-card-foreground shadow-lg animate-in fade-in zoom-in-95 duration-200 ${showEmailInput ? 'max-w-md' : 'max-w-4xl'}`}
      >
        <div className="flex flex-col space-y-1.5 p-6 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold leading-none tracking-tight">
              {showEmailInput ? 'Complete Account Setup' : 'Add New Account'}
            </h3>
            <button
              onClick={() => {
                setShowEmailInput(false);
                setActualEmail('');
                setActualUsername('');
                setAccountId(null);
                onOpenChange(false);
              }}
              className="rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {showEmailInput
              ? isPerplexity
                ? 'We could not detect your email or username. Please enter them manually.'
                : 'Please enter your actual email address for this account.'
              : 'Select a provider to connect your account.'}
          </p>
        </div>

        {showEmailInput ? (
          <form onSubmit={handleEmailSubmit} className="p-6 pt-2">
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                <div className="flex gap-2 items-center text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Error
                </div>
                <div className="text-sm mt-1">{error}</div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={actualEmail}
                  onChange={(e) => setActualEmail(e.target.value)}
                  placeholder="your-email@gmail.com"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  autoFocus
                  required
                />
                <p className="text-[0.8rem] text-muted-foreground">
                  This email will be used to identify your account.
                </p>
              </div>

              {isPerplexity && (
                <div className="space-y-2">
                  <label
                    htmlFor="username"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Username (Optional)
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={actualUsername}
                    onChange={(e) => setActualUsername(e.target.value)}
                    placeholder="e.g. user123 (Optional)"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Displayed name for your account.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-6">
              <button
                type="button"
                onClick={() => {
                  setShowEmailInput(false);
                  setActualEmail('');
                  setActualUsername('');
                  setAccountId(null);
                  onOpenChange(false);
                }}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 mt-2 sm:mt-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {loading ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </form>
        ) : (
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

            <div className="flex-1 flex gap-4 overflow-hidden">
              {/* Providers List - Left Side */}
              <div className="w-1/3 overflow-y-auto pr-2 border-r">
                <div className="space-y-2">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`cursor-pointer rounded-lg border p-3 transition-all hover:bg-accent hover:text-accent-foreground ${provider === p.id ? 'ring-2 ring-primary border-primary bg-accent/50' : 'bg-card'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-1.5 rounded-md ${p.color} border bg-background shrink-0`}
                        >
                          <img src={p.icon} alt={p.name} className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{p.name}</h4>
                          <p className="text-[10px] text-muted-foreground">{p.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 pl-2 overflow-y-auto">
                {provider === 'Antigravity' ? (
                  renderAntigravityContent()
                ) : (
                  <div className="flex flex-col h-full items-center justify-center text-center space-y-6">
                    <div
                      className={`p-4 rounded-full ${selectedProviderData?.color || 'bg-muted'} bg-opacity-20`}
                    >
                      <img src={selectedProviderData?.icon} className="w-12 h-12" alt={provider} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">
                        Login to {selectedProviderData?.name}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        {selectedProviderData?.loginMethod === 'Direct'
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

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <div className="text-xs text-muted-foreground">
                Selected:{' '}
                <span className="font-medium text-foreground">{selectedProviderData?.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
