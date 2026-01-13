import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border bg-card text-card-foreground shadow-lg animate-in fade-in zoom-in-95 duration-200 sm:max-w-[425px]">
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
              : 'Select a provider to log in.'}
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
          <form onSubmit={handleLogin} className="p-6 pt-2">
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
                  htmlFor="provider"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Provider
                </label>
                <div className="relative">
                  <select
                    id="provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                  >
                    <option value="Claude">Claude</option>
                    <option value="DeepSeek">DeepSeek</option>
                    <option value="ChatGPT">ChatGPT</option>
                    <option value="Mistral">Mistral</option>
                    <option value="Kimi">Kimi</option>
                    <option value="Qwen">Qwen</option>
                    <option value="Perplexity">Perplexity</option>
                    <option value="Groq">Groq</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-200">
                    <svg
                      className="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
                <p className="text-[0.8rem] text-muted-foreground">
                  You will be redirected to the login page.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-6">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 mt-2 sm:mt-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {loading ? 'Waiting...' : `Login with ${provider}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
