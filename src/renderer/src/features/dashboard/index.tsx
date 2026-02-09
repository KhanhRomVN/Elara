import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Zap, Database, Activity, Box, ChevronDown } from 'lucide-react';
import { SummaryCard } from './components/SummaryCard';
import { UsageChart } from './components/UsageChart';
import { ModelPieChart } from './components/ModelPieChart';
import { MiniTable } from './components/MiniTable';
import { Favicon } from '../../shared/utils/faviconUtils';
import { DASHBOARD_MOCK_DATA } from './dashboardMockData';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from '../../shared/components/ui/dropdown';

interface StatsData {
  accounts: any[];
  models: any[];
  history?: any[] | { day: any[]; week: any[]; month: any[]; year: any[] };
  providers?: any[];
  isBulk?: boolean;
}

const Dashboard = () => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [offset, setOffset] = useState(0);

  // Independent filters for tables
  const [accountPeriod, setAccountPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [modelPeriod, setModelPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [piePeriod, setPiePeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');

  // Main data for Summary + Chart
  const { data, isLoading, error } = useQuery<StatsData>({
    queryKey: ['stats', offset === 0 ? 'all' : period, offset],
    queryFn: () =>
      window.api.stats.getStats(offset === 0 ? undefined : period, offset) as Promise<StatsData>,
    refetchInterval: 30000,
  });

  // Independent Account Performance data
  const { data: accountData } = useQuery<any>({
    queryKey: ['stats', 'accounts', accountPeriod],
    queryFn: () => window.api.stats.getStats(accountPeriod, 0, 'accounts'),
    refetchInterval: 30000,
  });

  // Independent Model Performance data
  const { data: modelData } = useQuery<any>({
    queryKey: ['stats', 'models', modelPeriod],
    queryFn: () => window.api.stats.getStats(modelPeriod, 0, 'models'),
    refetchInterval: 30000,
  });

  // Independent Pie Chart data
  const { data: pieRawData } = useQuery<any>({
    queryKey: ['stats', 'models', piePeriod],
    queryFn: () => window.api.stats.getStats(piePeriod, 0, 'models'),
    refetchInterval: 30000,
  });

  const handlePeriodChange = useCallback((newPeriod: any) => setPeriod(newPeriod), []);
  const handlePrev = useCallback(() => setOffset((prev) => prev + 1), []);
  const handleNext = useCallback(() => setOffset((prev) => Math.max(0, prev - 1)), []);

  // Calculate Summary Metrics
  const { totalRequests, successRate } = useMemo(() => {
    const requests =
      data?.accounts.reduce((sum: number, acc: any) => sum + (acc.total_requests || 0), 0) || 0;
    const successful =
      data?.accounts.reduce((sum: number, acc: any) => sum + (acc.successful_requests || 0), 0) ||
      0;
    const rate = requests > 0 ? (successful / requests) * 100 : 0;

    return {
      totalRequests: requests,
      successRate: rate,
    };
  }, [data?.accounts]);

  // Prepare Chart Data from history
  const displayChartData = useMemo(() => {
    const historySource = DASHBOARD_MOCK_DATA[period] || [];
    return historySource.map((h: any) => ({
      date: h.date,
      requests: h.requests,
      tokens: h.tokens,
      providers: h.providers, // Pass providers for Tooltip breakdown
    }));
  }, [period]);

  // Prepare Provider Map for easy lookup
  const providerMap = useMemo(() => {
    return (
      data?.providers?.reduce((acc: any, p: any) => {
        acc[p.provider_id] = p;
        return acc;
      }, {}) || {}
    );
  }, [data?.providers]);

  // Prepare Pie Data
  const pieData = useMemo(() => {
    const sourceData = pieRawData?.models || [];
    const providerStats =
      sourceData.reduce((acc: any, m: any) => {
        acc[m.provider_id] = (acc[m.provider_id] || 0) + m.total_requests;
        return acc;
      }, {}) || {};

    return Object.entries(providerStats)
      .map(([name, value]) => ({
        name,
        value,
        website: providerMap[name]?.website,
      }))
      .filter((d: any) => (d.value as number) > 0);
  }, [pieRawData?.models, providerMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">Error loading dashboard: {(error as Error).message}</div>
    );
  }

  const renderTableFilter = (current: any, setter: any) => (
    <Dropdown size="sm">
      <DropdownTrigger className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-primary transition-colors bg-[var(--input-background)] px-2 py-1 rounded-md border border-[var(--divider)]">
        {current === 'day'
          ? 'Today'
          : current === 'week'
            ? 'Weekly'
            : current === 'month'
              ? 'Monthly'
              : 'Yearly'}
        <ChevronDown size={12} />
      </DropdownTrigger>
      <DropdownContent minWidth="100px">
        {['day', 'week', 'month', 'year'].map((p) => (
          <DropdownItem key={p} onClick={() => setter(p)} className="text-xs">
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-border divide-x divide-border">
            <SummaryCard
              title="Total Requests"
              value={totalRequests.toLocaleString()}
              icon={Zap}
              description="Lifetime API calls"
              trend={{ value: 12, isPositive: true }}
              color="text-violet-500"
              className="border-0 shadow-none rounded-none bg-transparent p-6"
            />
            <SummaryCard
              title="Success Rate"
              value={successRate.toFixed(1) + '%'}
              icon={Activity}
              description="Successful completions"
              trend={{ value: 1, isPositive: true }}
              color="text-emerald-500"
              className="border-0 shadow-none rounded-none bg-transparent p-6"
            />
            <SummaryCard
              title="Avg Tokens/Req"
              value={
                totalRequests > 0
                  ? (
                      data?.accounts.reduce(
                        (sum: number, a: any) => sum + (a.total_tokens || 0),
                        0,
                      ) / totalRequests
                    ).toFixed(0)
                  : '0'
              }
              icon={Database}
              description="Average model output"
              color="text-blue-500"
              className="border-0 shadow-none rounded-none bg-transparent p-6"
            />
            <SummaryCard
              title="Active Accounts"
              value={(data?.accounts?.length || 0).toString()}
              icon={Box}
              description="Configured credentials"
              color="text-amber-500"
              className="border-0 shadow-none rounded-none bg-transparent p-6"
            />
          </div>

          <div className="grid md:grid-cols-7 border-b border-border divide-x divide-border">
            <div className="col-span-4 p-6 bg-card/10">
              <UsageChart
                data={displayChartData}
                title="Usage Analytics"
                period={period}
                offset={offset}
                onPeriodChange={handlePeriodChange}
                onPrev={handlePrev}
                onNext={handleNext}
                className="border-0 shadow-none bg-transparent p-0"
              />
            </div>
            <div className="col-span-3 p-6 bg-card/10 relative">
              <div className="absolute top-6 right-6 z-10">
                {renderTableFilter(piePeriod, setPiePeriod)}
              </div>
              <ModelPieChart
                data={pieData}
                title="Provider Distribution"
                className="border-0 shadow-none bg-transparent p-0"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 divide-x divide-border">
            <div className="p-6 bg-card/5 relative">
              <div className="absolute top-4 right-6 z-10 flex items-center gap-3">
                {renderTableFilter(accountPeriod, setAccountPeriod)}
              </div>
              <MiniTable
                title="Top Accounts"
                data={accountData?.accounts || []}
                className="border-0 shadow-none bg-transparent p-0"
                columns={[
                  { header: 'Email', accessorKey: 'email', className: 'max-w-[150px] truncate' },
                  {
                    header: 'Provider',
                    accessorKey: 'provider_id',
                    className: 'text-center',
                    cell: (item) => {
                      const provider = providerMap[item.provider_id];
                      return (
                        <div className="flex items-center gap-2 justify-center">
                          <Favicon url={provider?.website} size={14} />
                          <span className="capitalize text-[11px] font-medium">
                            {item.provider_id}
                          </span>
                        </div>
                      );
                    },
                  },
                  {
                    header: 'Success | Req | Token',
                    accessorKey: 'metrics',
                    className: 'text-center',
                    cell: (item) => {
                      const rate =
                        item.total_requests > 0
                          ? (item.successful_requests / item.total_requests) * 100
                          : 0;
                      const tokens =
                        item.total_tokens > 1000
                          ? (item.total_tokens / 1000).toFixed(1) + 'k'
                          : item.total_tokens;
                      return (
                        <div className="flex items-center gap-1.5 text-[11px] justify-center">
                          <span
                            className={`font-bold ${rate > 90 ? 'text-emerald-500' : 'text-amber-500'}`}
                          >
                            {rate.toFixed(0)}%
                          </span>
                          <span className="text-[var(--text-tertiary)] opacity-30">|</span>
                          <span className="font-medium text-[var(--text-primary)]">
                            {item.total_requests}
                          </span>
                          <span className="text-[var(--text-tertiary)] opacity-30">|</span>
                          <span className="font-medium text-violet-400">{tokens}</span>
                        </div>
                      );
                    },
                  },
                ]}
              />
            </div>

            <div className="p-6 bg-card/5 relative">
              <div className="absolute top-4 right-6 z-10">
                {renderTableFilter(modelPeriod, setModelPeriod)}
              </div>
              <MiniTable
                title="Model Usage"
                data={modelData?.models || []}
                className="border-0 shadow-none bg-transparent p-0"
                columns={[
                  {
                    header: 'Model ID',
                    accessorKey: 'model_id',
                    className: 'max-w-[150px] truncate font-medium',
                  },
                  {
                    header: 'Provider',
                    accessorKey: 'provider_id',
                    className: 'text-center uppercase text-[10px] font-bold opacity-60',
                  },
                  {
                    header: 'Totals (Req|Token)',
                    accessorKey: 'totals',
                    className: 'text-center',
                    cell: (item) => (
                      <div className="flex items-center gap-1.5 text-[11px] justify-center">
                        <span className="text-[var(--text-primary)] font-bold">
                          {item.total_requests}
                        </span>
                        <span className="text-[var(--text-tertiary)] opacity-30">|</span>
                        <span className="text-violet-400 font-bold">
                          {(item.total_tokens / 1000).toFixed(1)}k
                        </span>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
