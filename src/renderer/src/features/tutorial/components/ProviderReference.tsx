import { useEffect, useState } from 'react';
import { ApiDocItem } from './ApiDocItem';

interface Account {
  id: string;
  provider: string;
  email: string;
  credentials: string;
}

interface Model {
  id: string;
  owned_by: string;
}

interface ProviderResponse {
  provider_id: string;
  provider_name: string;
  total_accounts: number;
  models: string[];
}

export const ProviderReference = () => {
  const [providersResponse, setProvidersResponse] = useState<string>(
    '[\n  // Loading real data...\n]',
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Start Server & Get Port
        const serverRes = await window.api.server.start();
        const port = serverRes.port || Number(import.meta.env.VITE_BACKEND_PORT) || 8888;

        // 2. Get Accounts
        const accounts: Account[] = await window.api.accounts.getAll();

        // 3. Get Models
        const modelsRes = await fetch(`http://localhost:${port}/v1/models`);
        const modelsData = await modelsRes.json();
        const models: Model[] = modelsData.data || [];

        // 4. Process Data for /v1/providers
        const providerMap = new Map<string, ProviderResponse>();

        // Process Accounts to build base map
        accounts.forEach((acc) => {
          const id = acc.provider.toLowerCase();
          if (!providerMap.has(id)) {
            providerMap.set(id, {
              provider_id: id,
              provider_name: acc.provider,
              total_accounts: 0,
              models: [],
            });
          }
          const p = providerMap.get(id)!;
          p.total_accounts++;
        });

        // Process Models
        models.forEach((model) => {
          const id = model.owned_by.toLowerCase();
          if (!providerMap.has(id)) {
            // Capitalize first letter for name if not found in accounts
            const name = id.charAt(0).toUpperCase() + id.slice(1);
            providerMap.set(id, {
              provider_id: id,
              provider_name: name,
              total_accounts: 0,
              models: [],
            });
          }
          const p = providerMap.get(id)!;
          if (!p.models.includes(model.id)) {
            p.models.push(model.id);
          }
        });

        const result = Array.from(providerMap.values());
        setProvidersResponse(JSON.stringify(result, null, 2));
      } catch (err) {
        console.error('Failed to fetch provider data', err);
        setProvidersResponse(
          JSON.stringify(
            {
              error: 'Failed to load real data',
              details: err instanceof Error ? err.message : String(err),
            },
            null,
            2,
          ),
        );
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-8 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Provider API Reference</h1>
        <p className="text-muted-foreground">
          APIs for managing and retrieving provider information and accounts.
        </p>
      </div>

      <ApiDocItem
        method="GET"
        endpoint="/v1/providers"
        description="Retrieve a list of all available providers, including their account counts and available models."
        resBody={providersResponse}
      />

      <ApiDocItem
        method="GET"
        endpoint="/v1/providers/:providerId/accounts"
        description="Retrieve all connected accounts for a specific provider."
        resBody={`[
  {
    "email": "user@example.com",
    "username": "User Name", // Optional
    "avatar": "https://lh3.googleusercontent.com/..." // Optional
  },
  {
    "email": "another@example.com",
    "username": null,
    "avatar": null
  }
]`}
      />
    </div>
  );
};
