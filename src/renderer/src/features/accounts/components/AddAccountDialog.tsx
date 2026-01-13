import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

import claudeIcon from '../../../assets/provider_icons/claude.svg';
import deepseekIcon from '../../../assets/provider_icons/deepseek.svg';
import openaiIcon from '../../../assets/provider_icons/openai.svg';
import mistralIcon from '../../../assets/provider_icons/mistral.svg';
import kimiIcon from '../../../assets/provider_icons/kimi.svg';
import qwenIcon from '../../../assets/provider_icons/qwen.svg';
import cohereIcon from '../../../assets/provider_icons/cohere.svg';
import perplexityIcon from '../../../assets/provider_icons/perplexity.svg';
import groqIcon from '../../../assets/provider_icons/groq.svg';
import geminiIcon from '../../../assets/provider_icons/gemini.svg';

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AddAccountDialog] handleLogin called for provider:', provider);
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
      id: 'ChatGPT',
      name: 'ChatGPT',
      description: 'Most Popular',
      icon: openaiIcon,
      color: 'bg-green-500/10 text-green-500 border-green-200/20',
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
  ];

  const selectedProviderData = providers.find((p) => p.id === provider);

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
          <form onSubmit={handleLogin} className="p-6 pt-2 h-[600px] flex flex-col">
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                <div className="flex gap-2 items-center text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Error
                </div>
                <div className="text-sm mt-1">{error}</div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all hover:bg-accent hover:text-accent-foreground relative ${provider === p.id ? 'ring-2 ring-primary border-primary bg-accent/50' : 'bg-card'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-md ${p.color} border bg-background`}>
                        <img src={p.icon} alt={p.name} className="w-6 h-6" />
                      </div>
                      {p.browserType === 'Real Browser' && (
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold text-muted-foreground border-zinc-700 bg-zinc-800/50">
                          Real Browser
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <h4 className="font-semibold">{p.name}</h4>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500" />
                      {p.loginMethod}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center pt-6 mt-auto border-t">
              <div className="text-sm text-muted-foreground hidden sm:block">
                {selectedProviderData && (
                  <span>
                    Selected:{' '}
                    <span className="font-medium text-foreground">{selectedProviderData.name}</span>
                  </span>
                )}
              </div>
              <div className="flex sm:space-x-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2 min-w-[120px]"
                >
                  {loading ? 'Waiting...' : `Login with ${provider}`}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
