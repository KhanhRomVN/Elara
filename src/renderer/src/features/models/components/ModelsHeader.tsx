import { Search } from 'lucide-react';
import { CustomSelect } from '../../playground/components/CustomSelect';
import { Favicon } from '../../../shared/utils/faviconUtils';
import { Provider, StatsPeriod } from '../types';

interface ModelsHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedProviderId: string;
  setSelectedProviderId: (id: string) => void;
  period: StatsPeriod;
  setPeriod: (period: StatsPeriod) => void;
  providers: Provider[];
  onRefresh: () => void;
}

export const ModelsHeader = ({
  searchQuery,
  setSearchQuery,
  selectedProviderId,
  setSelectedProviderId,
  period,
  setPeriod,
  providers,
  onRefresh,
}: ModelsHeaderProps) => {
  return (
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
            className="w-full bg-background border border-input rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all"
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
                icon: <Favicon url={p.website} size={16} className="rounded-sm shrink-0" />,
                disabled: false,
              })),
            ]}
            placeholder="Select Provider"
          />
        </div>

        {/* Period Filter */}
        <div className="relative z-20">
          <CustomSelect
            value={period}
            onChange={(val) => setPeriod(val as StatsPeriod)}
            options={[
              { value: 'day', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'year', label: 'This Year' },
            ]}
            placeholder="Period"
          />
        </div>
      </div>

      <button
        onClick={onRefresh}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
      >
        <span className="mr-2">Refresh</span>
      </button>
    </div>
  );
};
