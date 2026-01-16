import { useEffect, useState } from 'react';
import { Loader2, Server, User, Box } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface Account {
  id: string;
  provider: string;
  email: string;
  status: 'Active' | 'Rate Limit' | 'Error';
  picture?: string;
  name?: string;
}

interface Model {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  name?: string; // Some providers return name
}

interface ProviderData {
  name: string;
  accounts: Account[];
  models: Model[];
  loading: boolean;
  error?: string;
}

const SUPPORTED_PROVIDERS = [
  'StepFun', // Adding StepFun here ahead of time
  'Claude',
  'DeepSeek',
  'Mistral',
  'Kimi',
  'Qwen',
  'Cohere',
  'Perplexity',
  'Groq',
  'Gemini',
  'Antigravity',
  'HuggingChat',
  'LMArena',
];

export const ProviderReference = () => {
  const [providersData, setProvidersData] = useState<Record<string, ProviderData>>({});
  const [serverPort, setServerPort] = useState<number | null>(null);

  // Initialize Data Structure
  useEffect(() => {
    const initialData: Record<string, ProviderData> = {};
    SUPPORTED_PROVIDERS.forEach((p) => {
      initialData[p] = { name: p, accounts: [], models: [], loading: true };
    });
    setProvidersData(initialData);
  }, []);

  // 1. Start Server & Get Accounts
  useEffect(() => {
    const init = async () => {
      try {
        // @ts-ignore
        const serverRes = await window.api.server.start();
        if (serverRes.success && serverRes.port) {
          setServerPort(serverRes.port);
        }

        // @ts-ignore
        const accounts: Account[] = await window.api.accounts.getAll();

        setProvidersData((prev) => {
          const next = { ...prev };

          // Distribution accounts to providers
          Object.keys(next).forEach((key) => {
            next[key].accounts = accounts.filter((a) => a.provider === key);
          });

          return next;
        });
      } catch (err) {
        console.error('Initialization failed', err);
      }
    };

    init();
  }, []);

  // 2. Fetch Models when we have Port and Accounts
  useEffect(() => {
    if (!serverPort) return;

    const fetchModels = async (provider: string, account: Account) => {
      try {
        const email = encodeURIComponent(account.email);
        const baseUrl = `http://localhost:${serverPort}/v1`;
        let url = '';

        // Determine URL based on provider - mapping to known endpoints
        switch (provider.toLowerCase()) {
          case 'groq':
            url = `${baseUrl}/groq/models?email=${email}`;
            break;
          case 'antigravity':
            url = `${baseUrl}/antigravity/models?email=${email}`;
            break;
          case 'gemini':
            url = `${baseUrl}/gemini/models?email=${email}`;
            break;
          case 'huggingchat':
            url = `${baseUrl}/huggingchat/models?email=${email}`;
            break;
          case 'lmarena':
            url = `${baseUrl}/lmarena/models?email=${email}`;
            break;
          case 'stepfun':
            url = `${baseUrl}/stepfun/models?email=${email}`;
            break; // Future endpoint
          // For others, we might not have a dynamic endpoint yet, or it's standard
          default:
            // Try standard OpenAI compatible endpoint pattern if it exists, or skip
            // Many providers in this app don't have a /models endpoint exposed via proxy yet
            // or use hardcoded lists in frontend.
            // We will try a generic one if applicable, otherwise return empty.
            return [];
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();

        // Normalize data
        if (data.data && Array.isArray(data.data)) return data.data;
        if (data.models && Array.isArray(data.models)) return data.models;
        if (Array.isArray(data)) return data;

        return [];
      } catch (e) {
        console.warn(`Failed to fetch models for ${provider}`, e);
        return [];
      }
    };

    const loadAllModels = async () => {
      const updates: Record<string, Model[]> = {};

      const promises = Object.entries(providersData).map(async ([key, data]) => {
        if (data.accounts.length > 0) {
          const models = await fetchModels(key, data.accounts[0]);
          updates[key] = models;
        }
      });

      await Promise.all(promises);

      setProvidersData((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          next[key].loading = false;
          if (updates[key]) {
            next[key].models = updates[key];
          }
        });
        return next;
      });
    };

    if (Object.keys(providersData).length > 0) {
      loadAllModels();
    }
  }, [serverPort, providersData.Claude?.accounts.length]); // Trigget when accounts are populated (checking one provider as proxy)

  return (
    <div className="space-y-8 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Provider API Reference</h1>
        <p className="text-muted-foreground">
          Live view of available accounts and models for each provider.
        </p>
      </div>

      {Object.entries(providersData).map(([key, data]) => (
        <div key={key} className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-md">
              <Box className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">{data.name}</h3>
            {data.loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Accounts Section */}
            <div>
              <h4 className="flex items-center gap-2 font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                <User className="w-4 h-4" /> Connected Accounts
              </h4>
              {data.accounts.length > 0 ? (
                <div className="space-y-2">
                  {data.accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border/50"
                    >
                      {acc.picture ? (
                        <img src={acc.picture} className="w-8 h-8 rounded-full" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border">
                          <span className="text-xs font-bold">{acc.email[0].toUpperCase()}</span>
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium truncate">{acc.name || acc.email}</div>
                        <div className="text-xs text-muted-foreground truncate">{acc.email}</div>
                      </div>
                      <div
                        className={cn(
                          'ml-auto text-xs px-2 py-0.5 rounded-full capitalize',
                          acc.status === 'Active'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-red-500/10 text-red-500',
                        )}
                      >
                        {acc.status}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic p-4 border border-dashed rounded-md text-center">
                  No accounts connected.
                </div>
              )}
            </div>

            {/* Models Section */}
            <div>
              <h4 className="flex items-center gap-2 font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                <Server className="w-4 h-4" /> Available Models
              </h4>
              {data.models.length > 0 ? (
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  {data.models.map((model, idx) => (
                    <div
                      key={model.id || idx}
                      className="p-2 rounded-md bg-muted/30 border border-border/30 text-sm font-mono flex items-center justify-between group hover:bg-muted/50 transition-colors"
                    >
                      <span>{model.id || model.name}</span>
                      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {model.owned_by}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic p-4 border border-dashed rounded-md text-center">
                  {data.loading ? 'Fetching models...' : 'No models available or fetch failed.'}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
