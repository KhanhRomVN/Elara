import { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  RefreshCw,
  MoreHorizontal,
  Plus,
  ArrowDownUp,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import { CustomSelect } from '../playground/components/CustomSelect';

interface Model {
  id: string;
  name: string;
  is_thinking: boolean;
  context_length: number | null;
}

interface Provider {
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  models?: Model[];
}

interface FlatModel {
  model_id: string;
  model_name: string;
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  sequence?: number;
}

interface ModelSequence {
  model_id: string;
  provider_id: string;
  sequence: number;
}

export const ModelsPage = () => {
  const [flatModels, setFlatModels] = useState<FlatModel[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sequences, setSequences] = useState<ModelSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [insertTargetModel, setInsertTargetModel] = useState<FlatModel | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number>(1);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('all');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        activeDropdownId &&
        !(event.target as Element).closest('.row-dropdown-trigger') &&
        !(event.target as Element).closest('.row-dropdown-menu')
      ) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdownId]);

  useEffect(() => {
    const startServer = async () => {
      try {
        const res = await window.api.server.start();
        if (res.success && res.port) {
          setServerPort(res.port);
        }
      } catch (e) {
        console.error('Error starting server:', e);
      }
    };
    startServer();
  }, []);

  const fetchData = async () => {
    if (!serverPort) return;
    setLoading(true);
    try {
      // Fetch providers with models
      const providersRes = await fetch(`http://localhost:${serverPort}/v1/providers`);
      const providersData = await providersRes.json();

      if (providersData.success) {
        const providersList: Provider[] = providersData.data;
        setProviders(providersList); // Save full providers list for filter dropdown

        const models: FlatModel[] = [];

        providersList.forEach((provider) => {
          if (provider.models && provider.models.length > 0) {
            provider.models.forEach((model) => {
              models.push({
                model_id: model.id,
                model_name: model.name,
                provider_id: provider.provider_id,
                provider_name: provider.provider_name,
                is_enabled: provider.is_enabled !== false, // Default to true if undefined
              });
            });
          }
        });

        setFlatModels(models);
      }

      // Fetch sequences
      const sequencesRes = await fetch(`http://localhost:${serverPort}/v1/model-sequences`);
      const sequencesData = await sequencesRes.json();

      if (sequencesData.success) {
        setSequences(sequencesData.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverPort) {
      fetchData();
    }
  }, [serverPort]);

  const getModelSequence = (modelId: string, providerId: string): number | undefined => {
    const seq = sequences.find((s) => s.model_id === modelId && s.provider_id === providerId);
    return seq?.sequence;
  };

  const getMaxSequence = (): number => {
    if (sequences.length === 0) return 0;
    return Math.max(...sequences.map((s) => s.sequence));
  };

  const handleSetNextSequence = async (model: FlatModel) => {
    if (!serverPort) return;
    const nextSeq = getMaxSequence() + 1;

    try {
      const res = await fetch(`http://localhost:${serverPort}/v1/model-sequences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: model.model_id,
          provider_id: model.provider_id,
          sequence: nextSeq,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to set sequence:', error);
    }
    setActiveDropdownId(null);
  };

  const handleInsertSequence = async () => {
    if (!serverPort || !insertTargetModel) return;

    try {
      const res = await fetch(`http://localhost:${serverPort}/v1/model-sequences/insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: insertTargetModel.model_id,
          provider_id: insertTargetModel.provider_id,
          sequence: selectedSequence,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to insert sequence:', error);
    }
    setInsertDialogOpen(false);
    setInsertTargetModel(null);
    setActiveDropdownId(null);
  };

  const handleRemoveSequence = async (model: FlatModel) => {
    if (!serverPort) return;

    try {
      const res = await fetch(
        `http://localhost:${serverPort}/v1/model-sequences/${model.provider_id}/${model.model_id}`,
        {
          method: 'DELETE',
        },
      );
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to remove sequence:', error);
    }
    setActiveDropdownId(null);
  };

  const openInsertDialog = (model: FlatModel) => {
    setInsertTargetModel(model);
    setSelectedSequence(1);
    setInsertDialogOpen(true);
    setActiveDropdownId(null);
  };

  // Filter models
  const filteredModels = flatModels.filter((model) => {
    // Search query filter
    const matchesSearch =
      model.model_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider_id.toLowerCase().includes(searchQuery.toLowerCase());

    // Provider filter
    const matchesProvider =
      selectedProviderId === 'all' || model.provider_id === selectedProviderId;

    return matchesSearch && matchesProvider;
  });

  // Sort models:
  // 1. Sequence (ascending)
  // 2. Provider Enabled (enabled first)
  // 3. Model ID (alphabetical)
  const sortedModels = [...filteredModels].sort((a, b) => {
    const seqA = getModelSequence(a.model_id, a.provider_id);
    const seqB = getModelSequence(b.model_id, b.provider_id);

    // 1. Priority: Sequence
    if (seqA !== undefined && seqB !== undefined) {
      return seqA - seqB;
    }
    // Items with sequence come first
    if (seqA !== undefined) return -1;
    if (seqB !== undefined) return 1;

    // 2. Priority: Provider enabled status (disabled at bottom)
    if (a.is_enabled !== b.is_enabled) {
      return a.is_enabled ? -1 : 1;
    }

    // 3. Priority: Alphabetical
    return a.model_id.localeCompare(b.model_id);
  });

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

  return (
    <div className="space-y-4">
      <div className="mt-4">
        <h2 className="text-2xl font-bold tracking-tight">Models</h2>
        <p className="text-muted-foreground">Manage model sequences for priority ordering.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary/50 border border-input rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Provider Filter */}
          <div className="relative z-20">
            <CustomSelect
              value={selectedProviderId}
              onChange={setSelectedProviderId}
              options={[
                { value: 'all', label: 'All Providers' },
                ...providers.map((p) => ({
                  value: p.provider_id,
                  label: p.provider_name || p.provider_id,
                  subLabel: !p.is_enabled ? '(Disabled)' : undefined,
                  disabled: false,
                })),
              ]}
              placeholder="Select Provider"
            />
          </div>
        </div>

        <button
          onClick={() => fetchData()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[60px] text-center">
                  STT
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                  MODEL ID
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                  PROVIDER ID
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[100px] text-center">
                  SEQUENCE
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[100px] text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {sortedModels.length === 0 && (
                <tr>
                  <td colSpan={5} className="h-24 text-center text-muted-foreground">
                    No models available.
                  </td>
                </tr>
              )}
              {sortedModels.map((model, index) => {
                const sequence = getModelSequence(model.model_id, model.provider_id);
                const hasSequence = sequence !== undefined;
                const uniqueKey = `${model.provider_id}-${model.model_id}`;
                const maxSeq = getMaxSequence();

                return (
                  <tr
                    key={uniqueKey}
                    className={cn(
                      'border-b transition-colors hover:bg-muted/50',
                      hasSequence && 'bg-primary/5',
                    )}
                  >
                    <td className="p-4 align-middle text-muted-foreground text-center">
                      {index + 1}
                    </td>
                    <td className="p-4 align-middle">
                      <span className="font-mono text-sm">{model.model_id}</span>
                    </td>
                    <td className="p-4 align-middle">
                      <span className="text-sm text-muted-foreground">{model.provider_id}</span>
                    </td>
                    <td className="p-4 align-middle text-center">
                      {hasSequence ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          {sequence}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4 align-middle text-center">
                      <div className="relative inline-block" ref={dropdownRef}>
                        <button
                          onClick={() =>
                            setActiveDropdownId(activeDropdownId === uniqueKey ? null : uniqueKey)
                          }
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8 row-dropdown-trigger"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {activeDropdownId === uniqueKey && (
                          <div className="absolute right-0 top-full mt-1 w-56 rounded-md border bg-popover text-popover-foreground shadow-md z-50 row-dropdown-menu">
                            <div className="p-1">
                              {!hasSequence && (
                                <button
                                  onClick={() => handleSetNextSequence(model)}
                                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Set as sequence {maxSeq + 1}
                                </button>
                              )}
                              {!hasSequence && maxSeq > 0 && (
                                <button
                                  onClick={() => openInsertDialog(model)}
                                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                                >
                                  <ArrowDownUp className="mr-2 h-4 w-4" />
                                  Insert at sequence...
                                </button>
                              )}
                              {hasSequence && (
                                <button
                                  onClick={() => handleRemoveSequence(model)}
                                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-destructive/10 hover:text-destructive text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove sequence
                                </button>
                              )}
                              {!hasSequence && maxSeq === 0 && (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No actions available
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insert Sequence Dialog */}
      {insertDialogOpen && insertTargetModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setInsertDialogOpen(false)} />
          <div className="relative z-50 bg-background border rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Insert Sequence</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Insert <span className="font-mono font-medium">{insertTargetModel.model_id}</span> at
              position:
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {Array.from({ length: getMaxSequence() }, (_, i) => i + 1).map((seq) => (
                <button
                  key={seq}
                  onClick={() => setSelectedSequence(seq)}
                  className={cn(
                    'w-10 h-10 rounded-md border text-sm font-medium transition-colors',
                    selectedSequence === seq
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-accent',
                  )}
                >
                  {seq}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Models at position {selectedSequence} and after will be shifted down.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setInsertDialogOpen(false)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertSequence}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
