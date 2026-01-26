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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import { getApiBaseUrl } from '../../utils/apiUrl';
import { CustomSelect } from '../playground/components/CustomSelect';
import { Favicon } from '../../shared/utils/faviconUtils';

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
  website?: string;
  models?: Model[];
}

interface FlatModel {
  model_id: string;
  model_name: string;
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  sequence?: number;
  success_rate?: number;
  max_req_conversation?: number;
  max_token_conversation?: number;
  website?: string; // Cache website for favicon
}

interface ModelSequence {
  model_id: string;
  provider_id: string;
  sequence: number;
}

type SortKey = 'success_rate' | 'max_req_conversation' | 'max_token_conversation' | '';
type SortDirection = 'asc' | 'desc' | 'none';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [maxHeight, setMaxHeight] = useState<number | string>('600px');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sorting state
  const [sortKey, setSortKey] = useState<SortKey>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('none');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tableContainerRef.current) return;

    const calculateRows = () => {
      if (!tableContainerRef.current) return;

      // Constants for heights
      const headerHeight = 48; // h-12
      const footerHeight = 65; // Pagination footer height
      const rowHeight = 50; // Increased for favicon
      const padding = 16; // Safety padding

      // Calculate available height within the container
      // However, the container itself should ideally be constrained by the viewport
      // If the container is just auto-height, we should look at viewport
      const viewportHeight = window.innerHeight;
      const containerTop = tableContainerRef.current.getBoundingClientRect().top;

      // Space from top of table to bottom of screen
      const availableHeight = viewportHeight - containerTop - 32; // 32px safety bottom

      if (availableHeight > 200) {
        // More precise row calculation
        const usableHeight = availableHeight - headerHeight - footerHeight - 10;
        const calculatedCount = Math.floor(usableHeight / rowHeight);
        setItemsPerPage(Math.max(5, calculatedCount));
        setMaxHeight(availableHeight);
      }
    };

    calculateRows();
    window.addEventListener('resize', calculateRows);

    // Also use ResizeObserver for more accuracy if parent layout changes
    const observer = new ResizeObserver(calculateRows);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('resize', calculateRows);
      observer.disconnect();
    };
  }, [loading]);

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
      const baseUrl = getApiBaseUrl(serverPort);
      const providersRes = await fetch(`${baseUrl}/v1/providers`);
      const providersData = await providersRes.json();

      if (providersData.success) {
        const providersList: Provider[] = providersData.data;
        setProviders(providersList); // Save full providers list for filter dropdown

        const models: FlatModel[] = [];

        providersList.forEach((provider) => {
          if (provider.models && provider.models.length > 0) {
            provider.models.forEach((model: any) => {
              models.push({
                model_id: model.id || model.name,
                model_name: model.name,
                provider_id: provider.provider_id,
                provider_name: provider.provider_name,
                is_enabled: provider.is_enabled !== false, // Default to true if undefined
                success_rate: model.success_rate, // Updated mapping
                max_req_conversation: model.max_req_conversation,
                max_token_conversation: model.max_token_conversation,
                website: provider.website,
              });
            });
          }
        });

        setFlatModels(models);
      }

      // Fetch sequences
      const sequencesRes = await fetch(`${baseUrl}/v1/model-sequences`);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedProviderId]);

  const getModelSequence = (modelId: string, providerId: string): number | undefined => {
    const seq = sequences.find(
      (s) =>
        s.model_id.toLowerCase() === modelId.toLowerCase() &&
        s.provider_id.toLowerCase() === providerId.toLowerCase(),
    );
    return seq?.sequence;
  };

  const getMaxSequence = (): number => {
    return sequences.length > 0 ? Math.max(...sequences.map((s) => s.sequence)) : 0;
  };

  const handleSetNextSequence = async (model: FlatModel) => {
    if (!serverPort) return;
    const nextSeq = getMaxSequence() + 1;

    try {
      const baseUrl = getApiBaseUrl(serverPort);
      const res = await fetch(`${baseUrl}/v1/model-sequences`, {
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
      const baseUrl = getApiBaseUrl(serverPort);
      const res = await fetch(`${baseUrl}/v1/model-sequences/insert`, {
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
      const baseUrl = getApiBaseUrl(serverPort);
      const res = await fetch(
        `${baseUrl}/v1/model-sequences/${model.provider_id}/${model.model_id}`,
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

  // Sorting Handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // Toggle: asc -> desc -> none
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') setSortDirection('none');
      else setSortDirection('asc'); // none -> asc
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key || sortDirection === 'none')
      return <ArrowDownUp className="w-3 h-3 ml-1" />;
    if (sortDirection === 'asc') return <ChevronUp className="w-3 h-3 ml-1" />;
    return <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const getSortColorClass = (key: SortKey) => {
    if (sortKey !== key || sortDirection === 'none')
      return 'text-muted-foreground hover:text-foreground';
    if (sortDirection === 'asc') return 'text-green-500 hover:text-green-600';
    return 'text-red-500 hover:text-red-600';
  };

  // Filter models
  const filteredModels = flatModels.filter((model) => {
    // Search query filter
    const matchesSearch =
      (model.model_id?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (model.provider_id?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    // Provider filter
    const matchesProvider =
      selectedProviderId === 'all' || model.provider_id === selectedProviderId;

    return matchesSearch && matchesProvider;
  });

  // Sort models
  const sortedModels = [...filteredModels].sort((a, b) => {
    // 1. Custom Stats Sorting
    if (sortDirection !== 'none' && sortKey) {
      const valA = a[sortKey] || 0;
      const valB = b[sortKey] || 0;

      if (valA !== valB) {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
    }

    // 2. Default Prioritized Sorting
    const seqA = getModelSequence(a.model_id, a.provider_id);
    const seqB = getModelSequence(b.model_id, b.provider_id);

    // Sequence priority
    if (seqA !== undefined && seqB !== undefined) return seqA - seqB;
    if (seqA !== undefined) return -1;
    if (seqB !== undefined) return 1;

    // Enabled status priority
    if (a.is_enabled !== b.is_enabled) return a.is_enabled ? -1 : 1;

    // Alphabetical
    return a.model_id.localeCompare(b.model_id);
  });

  // Calculate pagination
  const totalItems = sortedModels.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedModels = sortedModels.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
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

      <div
        ref={tableContainerRef}
        style={{ maxHeight }}
        className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col"
      >
        <div className="w-full overflow-auto flex-1">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="sticky top-0 bg-card z-10 border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[60px] text-center">
                  STT
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Model</th>
                <th
                  className={cn(
                    'h-12 px-4 align-middle font-medium cursor-pointer text-center select-none transition-colors',
                    getSortColorClass('success_rate'),
                  )}
                  onClick={() => handleSort('success_rate')}
                >
                  <div className="flex items-center justify-center">
                    Success Rate
                    {getSortIcon('success_rate')}
                  </div>
                </th>
                <th
                  className={cn(
                    'h-12 px-4 align-middle font-medium cursor-pointer text-center select-none transition-colors',
                    getSortColorClass('max_req_conversation'),
                  )}
                  onClick={() => handleSort('max_req_conversation')}
                >
                  <div className="flex items-center justify-center">
                    Max Req/Conv
                    {getSortIcon('max_req_conversation')}
                  </div>
                </th>
                <th
                  className={cn(
                    'h-12 px-4 align-middle font-medium cursor-pointer text-center select-none transition-colors',
                    getSortColorClass('max_token_conversation'),
                  )}
                  onClick={() => handleSort('max_token_conversation')}
                >
                  <div className="flex items-center justify-center">
                    Max Token/Conv
                    {getSortIcon('max_token_conversation')}
                  </div>
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
              {paginatedModels.length === 0 && (
                <tr>
                  <td colSpan={7} className="h-24 text-center text-muted-foreground">
                    No models available.
                  </td>
                </tr>
              )}
              {paginatedModels.map((model, index) => {
                const sequence = getModelSequence(model.model_id, model.provider_id);
                const absoluteIndex = startIndex + index + 1;
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
                    <td className="px-4 py-1.5 align-middle text-muted-foreground text-center">
                      {absoluteIndex}
                    </td>
                    <td className="px-4 py-1.5 align-middle">
                      <div className="flex items-center gap-2 truncate flex-1">
                        <div className="w-32 shrink-0 flex items-center justify-end gap-1.5">
                          <Favicon
                            url={model.website}
                            size={14}
                            className="rounded-sm opacity-70"
                          />
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0 lowercase">
                            {model.provider_id}
                          </span>
                        </div>
                        <span className="text-zinc-700 font-light shrink-0">|</span>
                        <span className="truncate flex-1 font-medium">{model.model_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-1.5 align-middle text-center">
                      <span className="text-sm">{model.success_rate || 0}%</span>
                    </td>
                    <td className="px-4 py-1.5 align-middle text-center">
                      <span className="text-sm">{model.max_req_conversation || 0}</span>
                    </td>
                    <td className="px-4 py-1.5 align-middle text-center">
                      <span className="text-sm">
                        {(model.max_token_conversation || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 align-middle text-center">
                      {hasSequence ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          {sequence}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-1.5 align-middle text-center">
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

        {/* Server-Side style Pagination Footer */}
        {totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of{' '}
              {totalItems} models
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 disabled:opacity-50 transition-colors"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
              <div className="text-sm font-medium px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 disabled:opacity-50 transition-colors"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        )}
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
