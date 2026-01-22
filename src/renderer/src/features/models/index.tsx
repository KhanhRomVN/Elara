import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { providers } from '../../config/providers';
import {
  getCachedModels,
  fetchAndCacheModels,
  startBackgroundSync,
  stopBackgroundSync,
} from '../../utils/model-cache';

interface Account {
  id: string;
  provider_id: string;
  email: string;
  status: 'Active' | 'Rate Limit' | 'Error';
}

interface ProviderModels {
  providerId: string;
  providerName: string;
  models: string[];
  error?: string;
  loading?: boolean;
}

export const ModelsPage = () => {
  const [providerModels, setProviderModels] = useState<ProviderModels[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fetchAllData = async (useCache = true) => {
    setLoading(true);
    setGlobalError(null);
    try {
      const accounts: Account[] = await window.api.accounts.getAll();

      const serverStatus = await window.api.server.start();
      const port = serverStatus.port || 11434;

      const activeProviders = providers.filter((p) => p.active);
      const results: ProviderModels[] = [];

      for (const provider of activeProviders) {
        const pModels: ProviderModels = {
          providerId: provider.id,
          providerName: provider.name,
          models: [],
        };

        try {
          // Find account for this provider
          const account =
            accounts.find((a) => a.provider_id === provider.id && a.status === 'Active') ||
            accounts.find((a) => a.provider_id === provider.id);

          if (!account) {
            // Most providers need accounts to fetch models - can check a flag if added to config
            pModels.error = 'No connected account';
          } else {
            // Try cache first if useCache is true
            if (useCache) {
              const cached = getCachedModels(provider.id);
              if (cached && cached.length > 0) {
                pModels.models = cached.map((m) => m.id);
                results.push(pModels);
                continue; // Skip to next provider, background sync will update
              }
            }

            // Fetch from API
            const fetchedModels = await fetchAndCacheModels(provider.id, account.email, port);
            if (fetchedModels.length > 0) {
              pModels.models = fetchedModels.map((m) => m.id);
            } else {
              // If fetch failed but we have cache, use it
              const cached = getCachedModels(provider.id);
              if (cached && cached.length > 0) {
                pModels.models = cached.map((m) => m.id);
              }
            }
          }
        } catch (err: any) {
          console.error(`Failed to fetch models for ${provider.id}:`, err);
          pModels.error = err.message || 'Failed to fetch';

          // Try cache as fallback
          const cached = getCachedModels(provider.id);
          if (cached && cached.length > 0) {
            pModels.models = cached.map((m) => m.id);
            delete pModels.error; // Clear error if we have cached data
          }
        }

        results.push(pModels);
      }

      setProviderModels(results);

      // Start background sync
      startBackgroundSync(accounts, port);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to initialize');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Cleanup background sync on unmount
    return () => {
      stopBackgroundSync();
    };
  }, []);

  const handleRefresh = () => {
    fetchAllData(false); // Force refresh from API, skip cache
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading models...</p>
        </div>
      </div>
    );
  }

  if (globalError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-4">{globalError}</p>
          <button
            onClick={() => fetchAllData()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Models</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Available AI models grouped by provider
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Models List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {providerModels.map((pm) => (
            <div key={pm.providerId} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{pm.providerName}</h2>
                <span className="text-xs text-muted-foreground border px-1.5 py-0.5 rounded">
                  {pm.providerId}
                </span>
              </div>

              {pm.loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground ml-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                </div>
              ) : pm.error ? (
                <div className="flex items-center gap-2 text-sm text-amber-500 ml-2">
                  <AlertTriangle className="h-3 w-3" /> {pm.error}
                </div>
              ) : pm.models.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-muted-foreground ml-2">
                  {pm.models.map((modelId) => (
                    <li key={modelId} className="font-mono">
                      {modelId}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic ml-2">No models available.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
