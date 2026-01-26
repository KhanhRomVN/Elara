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
  const { totalRequests, successRate, maxReqConv, maxTokenConv } = useMemo(() => {
    const requests =
      data?.accounts.reduce((sum: number, acc: any) => sum + (acc.total_requests || 0), 0) || 0;
    const successful =
      data?.accounts.reduce((sum: number, acc: any) => sum + (acc.successful_requests || 0), 0) ||
      0;
    const rate = requests > 0 ? (successful / requests) * 100 : 0;

    const maxReq =
      data?.models.reduce((max: number, m: any) => Math.max(max, m.max_req_conversation || 0), 0) ||
      0;
    const maxToken =
      data?.models.reduce(
        (max: number, m: any) => Math.max(max, m.max_token_conversation || 0),
        0,
      ) || 0;

    return {
      totalRequests: requests,
      successRate: rate,
      maxReqConv: maxReq,
      maxTokenConv: maxToken,
    };
  }, [data?.accounts, data?.models]);

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
    <div className="h-full overflow-y-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Real-time overview of your AI infrastructure performance.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <SummaryCard
          title="Total Requests"
          value={totalRequests.toLocaleString()}
          icon={Zap}
          description="Lifetime API calls"
          trend={{ value: 12, isPositive: true }}
          color="text-violet-500"
        />
        <SummaryCard
          title="Success Rate"
          value={successRate.toFixed(1) + '%'}
          icon={Activity}
          description="Successful completions"
          trend={{ value: 1, isPositive: true }}
          color="text-emerald-500"
        />
        <SummaryCard
          title="Max Req/Conv"
          value={maxReqConv.toLocaleString()}
          icon={Database}
          description="Peak queries in chat"
          color="text-blue-500"
        />
        <SummaryCard
          title="Max Tokens/Conv"
          value={(maxTokenConv / 1000).toFixed(1) + 'k'}
          icon={Box}
          description="Peak total tokens"
          color="text-amber-500"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-7 mb-8">
        <UsageChart
          data={displayChartData}
          title="Usage Analytics"
          period={period}
          offset={offset}
          onPeriodChange={handlePeriodChange}
          onPrev={handlePrev}
          onNext={handleNext}
        />
        <div className="relative col-span-3">
          <div className="absolute top-6 right-6 z-10">
            {renderTableFilter(piePeriod, setPiePeriod)}
          </div>
          <ModelPieChart data={pieData} title="Provider Distribution" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative">
          <div className="absolute top-4 right-6 z-10 flex items-center gap-3">
            {renderTableFilter(accountPeriod, setAccountPeriod)}
          </div>
          <MiniTable
            title="Top Accounts"
            data={accountData?.accounts || []}
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
                      <span className="capitalize text-[11px] font-medium">{item.provider_id}</span>
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

        <div className="relative">
          <div className="absolute top-4 right-6 z-10">
            {renderTableFilter(modelPeriod, setModelPeriod)}
          </div>
          <MiniTable
            title="Model Performance"
            data={modelData?.models || []}
            columns={[
              {
                header: 'Model ID',
                accessorKey: 'model_id',
                className: 'max-w-[120px] truncate font-medium',
              },
              {
                header: 'Max Load (Req|Token)',
                accessorKey: 'max_load',
                className: 'text-center',
                cell: (item) => (
                  <div className="flex items-center gap-1.5 text-[11px] justify-center">
                    <span className="text-blue-400 font-medium">
                      {item.max_req_conversation || 0}
                    </span>
                    <span className="text-[var(--text-tertiary)] opacity-30">|</span>
                    <span className="text-amber-400 font-medium">
                      {(item.max_token_conversation / 1000).toFixed(1)}k
                    </span>
                  </div>
                ),
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
  );
};

export default Dashboard;
