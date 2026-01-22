import { useState } from 'react';
import { ExternalLink, RefreshCw, Check, Copy, Key } from 'lucide-react';

interface AntigravityAddAccountProps {
  onAccountPending: (account: any) => void;
  onError: (error: string) => void;
  serverPort: number | null;
}

type AddMethod = 'oauth' | 'manual';

export function AntigravityAddAccount({ onAccountPending, onError }: AntigravityAddAccountProps) {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<AddMethod>('oauth');

  // OAuth States
  const [oauthUrl, setOauthUrl] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);

  // Manual Token States
  const [tokenInput, setTokenInput] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');

  const handleStartOAuth = async () => {
    setLoading(true);
    onError('');
    setIsWaiting(true);
    try {
      const prep = await window.api.accounts.antigravity.prepareOAuth();
      if (!prep.success) {
        throw new Error(prep.error);
      }
      setOauthUrl(prep.url);

      const result = await window.api.accounts.antigravity.completeOAuth();
      if (result.success) {
        onAccountPending(result.account);
      } else {
        onError(result.error || 'OAuth failed');
      }
    } catch (e: any) {
      onError(e.message || 'Failed to start OAuth');
    } finally {
      setLoading(false);
      setIsWaiting(false);
    }
  };

  const extractRefreshTokens = (input: string): string[] => {
    let tokens: string[] = [];
    const trimmed = input.trim();

    // Try parsing as JSON array
    try {
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          tokens = parsed
            .map((item: any) => item.refresh_token || item)
            .filter((t: any) => typeof t === 'string' && t.startsWith('1//'));
        }
      }
    } catch (e) {
      // JSON parse failed, continue to regex
    }

    // If no tokens from JSON, use regex to extract from plain text
    if (tokens.length === 0) {
      const regex = /1\/\/ [a-zA-Z0-9_-]+/g;
      const matches = trimmed.match(regex);
      if (matches) {
        tokens = matches;
      }
    }

    // Remove duplicates
    return [...new Set(tokens)];
  };

  const handleManualSubmit = async () => {
    if (!tokenInput.trim()) {
      onError('Please enter at least one refresh token');
      return;
    }

    const tokens = extractRefreshTokens(tokenInput);

    if (tokens.length === 0) {
      onError('No valid refresh tokens found. Tokens should start with "1//"');
      return;
    }

    setLoading(true);
    onError('');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      setProcessingStatus(`Processing token ${i + 1} of ${tokens.length}...`);

      try {
        onAccountPending({
          provider_id: 'antigravity',
          email: '', // Will be fetched by backend
          credential: token,
        });
        successCount++;
        await new Promise((r) => setTimeout(r, 100)); // Brief delay
      } catch (e: any) {
        console.error(`Failed to add token ${i + 1}:`, e);
        failCount++;
      }
    }

    setLoading(false);
    setProcessingStatus('');

    if (successCount === tokens.length) {
      setTokenInput('');
      // Success message will be shown by parent
    } else if (successCount > 0) {
      onError(`Added ${successCount} account(s), ${failCount} failed`);
    } else {
      onError('All tokens failed to add');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Method Tabs */}
      <div className="flex gap-2 p-2 bg-muted/20 rounded-lg mb-4">
        <button
          type="button"
          onClick={() => setMethod('oauth')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            method === 'oauth'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-transparent hover:bg-muted/50'
          }`}
        >
          <ExternalLink className="inline-block mr-2 h-4 w-4" />
          Google OAuth
        </button>
        <button
          type="button"
          onClick={() => setMethod('manual')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            method === 'manual'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-transparent hover:bg-muted/50'
          }`}
        >
          <Key className="inline-block mr-2 h-4 w-4" />
          Refresh Token
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {method === 'oauth' ? (
          <div className="flex flex-col items-center justify-center space-y-6 py-4 px-2">
            <div className="text-center space-y-2">
              <h4 className="font-medium text-lg">Sign in with Google</h4>
              <p className="text-sm text-muted-foreground max-w-md">
                Authenticate securely via Google to access Antigravity services. A local server will
                catch the callback from your browser.
              </p>
            </div>

            {!oauthUrl ? (
              <button
                type="button"
                onClick={handleStartOAuth}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 py-2 w-full max-w-sm shadow-sm"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {loading ? 'Preparing...' : 'Generate Login URL'}
              </button>
            ) : (
              <div className="w-full max-w-md space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg border text-sm">
                  {isWaiting ? (
                    <div className="flex flex-col items-center gap-3 py-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      <div className="text-center">
                        <p className="font-medium">Waiting for browser login...</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Please complete the login in the opened tab.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Setup ready!</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    OAuth URL (Open in browser)
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={oauthUrl}
                      className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(oauthUrl)}
                      className="inline-flex items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                      title="Copy URL"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <a
                      href={oauthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                      title="Open in Browser"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 px-2 py-4">
            <div className="text-center space-y-2 mb-4">
              <h4 className="font-medium text-lg">Manual Refresh Token</h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Paste your Google refresh token(s). Supports JSON arrays or plain text with embedded
                tokens.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Refresh Token(s)
              </label>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                disabled={loading}
                placeholder={`Example:\n1//0g...\n\nOr JSON:\n[{"refresh_token": "1//0g..."}]`}
                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Tokens must start with "1//". Multiple tokens will be added as separate accounts.
              </p>
            </div>

            {processingStatus && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300">
                {processingStatus}
              </div>
            )}

            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={loading || !tokenInput.trim()}
              className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 py-2 shadow-sm"
            >
              <Key className="mr-2 h-4 w-4" />
              {loading ? 'Adding...' : 'Add Account(s)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
