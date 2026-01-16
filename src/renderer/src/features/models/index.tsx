import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';

interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  description?: string;
}

interface GroupedModels {
  [provider: string]: Model[];
}

export const ModelsPage = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      // @ts-ignore
      const status = await window.api.server.start();
      const port = status.port || 11434;

      const response = await fetch(`http://localhost:${port}/v1/models`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setModels(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load models');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const groupedModels: GroupedModels = models.reduce((acc, model) => {
    const provider = model.owned_by || 'unknown';
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(model);
    return acc;
  }, {} as GroupedModels);

  const toggleProvider = (provider: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(provider)) {
      newExpanded.delete(provider);
    } else {
      newExpanded.add(provider);
    }
    setExpandedProviders(newExpanded);
  };

  const handleRefresh = async () => {
    try {
      // @ts-ignore
      const status = await window.api.server.start();
      const port = status.port || 11434;

      await fetch(`http://localhost:${port}/v1/models/refresh`, {
        method: 'POST',
      });

      await fetchModels();
    } catch (err: any) {
      setError(err.message || 'Failed to refresh models');
    }
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchModels}
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
        {Object.keys(groupedModels).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No models available</p>
            <p className="text-sm text-muted-foreground mt-2">
              Make sure your models.json file is properly configured
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedModels)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([provider, providerModels]) => (
                <div key={provider} className="border border-border rounded-lg overflow-hidden">
                  {/* Provider Header */}
                  <button
                    onClick={() => toggleProvider(provider)}
                    className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedProviders.has(provider) ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                      <h2 className="text-lg font-semibold capitalize">{provider}</h2>
                      <span className="text-sm text-muted-foreground">
                        ({providerModels.length} models)
                      </span>
                    </div>
                  </button>

                  {/* Models List */}
                  {expandedProviders.has(provider) && (
                    <div className="divide-y divide-border">
                      {providerModels.map((model) => (
                        <div key={model.id} className="p-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-mono text-sm font-medium">{model.id}</h3>
                              {model.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {model.description}
                                </p>
                              )}
                              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Type: {model.object}</span>
                                <span>
                                  Created: {new Date(model.created * 1000).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
