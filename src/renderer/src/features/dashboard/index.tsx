import { useState, useEffect } from 'react';
import { BarChart3, Users, Zap, TrendingUp } from 'lucide-react';
import { aggregateUsage, TokenUsageData, AggregatedUsage } from './utils/historyFetcher';
import { TokenUsageChart } from './components/TokenUsageChart';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalAccounts: 0,
    activeAccounts: 0,
    todayRequests: 0,
    todayTokens: 0,
  });
  const [dailyHistory, setDailyHistory] = useState<any[]>([]);
  const [activeAccountList, setActiveAccountList] = useState<any[]>([]);

  // Token Usage State
  const [usageData, setUsageData] = useState<TokenUsageData[]>([]);
  const [aggregatedUsage, setAggregatedUsage] = useState<AggregatedUsage | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted) return;
      try {
        const [accounts, statsData] = await Promise.all([
          window.api.accounts.getAll(),
          window.api.stats.getStats(),
        ]);

        const activeAccs = accounts.filter((a: any) => a.isEnabled); // Assuming isEnabled is the property

        setStats({
          totalAccounts: accounts.length,
          activeAccounts: activeAccs.length,
          todayRequests: statsData.todayRequests,
          todayTokens: statsData.todayTokens,
        });

        setDailyHistory(statsData.history);
        setActiveAccountList(activeAccs.slice(0, 5)); // Top 5

        // Smart Caching Logic for Token Usage
        const CACHE_KEY = 'dashboard-token-usage-v1';
        let cachedData: TokenUsageData[] = [];
        // let maxTimestamp = 0;

        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            cachedData = JSON.parse(cached);
            setUsageData(cachedData); // Instant load
            setAggregatedUsage(aggregateUsage(cachedData, viewMode));

            // Find max timestamp to fetch only new data
            if (cachedData.length > 0) {
              // maxTimestamp = Math.max(...cachedData.map((d) => d.timestamp));
            }
          }
        } catch (e) {
          console.error('Failed to load cached usage data', e);
        }

        // DISABLED: Token usage HTTPS fetching
        // Fetch only new data incrementally
        setLoadingUsage(false);
        /* DISABLED - HTTPS token fetch
        setLoadingUsage(true);
        // @ts-expect-error: ignore type mismatch
        const newHistory = await fetchAllHistory(accounts, maxTimestamp);

        if (newHistory.length > 0) {
          console.log(`[Dashboard] Fetched ${newHistory.length} new usage records.`);
          // Merge and deduplicate
          const merged = [...cachedData, ...newHistory];
          // Ensure uniqueness by timestamp + provider (simple dedup)
          // Or just sort? fetchAllHistory filters by > lastTimestamp so should be unique.
          // Sort by timestamp
          merged.sort((a, b) => a.timestamp - b.timestamp);

          setUsageData(merged);
          localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
        } else {
          console.log('[Dashboard] No new usage data found.');
        }

        setLoadingUsage(false);
        */
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setLoadingUsage(false);
      }
    };

    fetchData();
    // Refresh stats (lightweight) every 60s
    const interval = setInterval(fetchData, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []); // Re-fetch on mount. We might want to re-aggregate when viewMode changes.

  useEffect(() => {
    if (usageData.length > 0) {
      setAggregatedUsage(aggregateUsage(usageData, viewMode));
    }
  }, [viewMode, usageData]);

  const statItems = [
    {
      title: 'Total Accounts',
      value: stats.totalAccounts.toString(),
      icon: Users,
      description: `${stats.activeAccounts} active`,
    },
    {
      title: 'Requests Today',
      value: stats.todayRequests.toString(),
      icon: Zap,
      description: 'API Calls',
    },
    {
      title: 'Tokens Today',
      value: stats.todayTokens.toLocaleString(),
      icon: BarChart3,
      description: 'Estimated usage',
    },
  ];

  const availableProviders = aggregatedUsage
    ? Array.from(new Set(Object.keys(aggregatedUsage.byProvider)))
    : [];

  const chartData =
    aggregatedUsage?.history.map((item) => {
      if (selectedProvider === 'all') return item;

      // Filter by provider
      return {
        ...item,
        byProvider: {
          [selectedProvider]: item.byProvider[selectedProvider] || 0,
        },
      };
    }) || [];

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">
          Overview of your AI providers and account usage.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statItems.map((stat, i) => (
          <div key={i} className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">{stat.title}</h3>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="content">
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Usage Chart */}
        <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5 mb-6">
            <h3 className="font-semibold leading-none tracking-tight">Daily Requests</h3>
            <p className="text-sm text-muted-foreground">Request volume over the last 30 days.</p>
          </div>
          <div className="space-y-4">
            {/* Simple bar chart using CSS */}
            <div className="flex items-end gap-2 h-40">
              {dailyHistory.slice(-14).map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full bg-primary/20 hover:bg-primary/40 transition-colors rounded-t-sm relative"
                    style={{
                      height: `${Math.max(5, (day.requests / (Math.max(...dailyHistory.map((d) => d.requests)) || 1)) * 100)}%`,
                    }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow pointer-events-none whitespace-nowrap z-10">
                      {day.date}: {day.requests} reqs
                    </div>
                  </div>
                </div>
              ))}
              {dailyHistory.length === 0 && (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  No data yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Accounts List */}
        <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5 mb-6">
            <h3 className="font-semibold leading-none tracking-tight">Active Accounts</h3>
            <p className="text-sm text-muted-foreground">Currently enabled accounts.</p>
          </div>
          <div className="space-y-4">
            {activeAccountList.map((acc, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-primary" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate">
                      {acc.email || acc.name || 'Unnamed Account'}
                    </span>
                    <span className="text-xs text-muted-foreground">{acc.provider_id}</span>
                  </div>
                </div>
                <div className="font-mono text-xs font-bold text-green-500">Active</div>
              </div>
            ))}
            {activeAccountList.length === 0 && (
              <div className="text-sm text-muted-foreground">No active accounts found.</div>
            )}
          </div>
        </div>
      </div>

      {/* Token Usage Section */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col space-y-1.5">
            <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Token Usage Trends
            </h3>
            <p className="text-sm text-muted-foreground">
              Accumulated token consumption across providers.
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Provider Filter */}
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All Providers</option>
              {availableProviders.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Time View Toggle */}
            <div className="flex items-center space-x-2 bg-muted/20 p-1 rounded-lg">
              {(['day', 'week', 'month'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === m
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadingUsage ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading usage data...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Provider Stats List */}
            <div className="md:col-span-1 border-r pr-6 space-y-4 max-h-[350px] overflow-y-auto">
              {availableProviders.sort().map((p) => {
                const reqs = aggregatedUsage?.requestsByProvider[p] || 0;
                const tokens = aggregatedUsage?.byProvider[p] || 0;

                return (
                  <div
                    key={p}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-medium text-sm truncate">{p}</span>
                    </div>
                    <div className="flex-shrink-0 font-mono text-xs text-muted-foreground">
                      {reqs} <span className="mx-1 opacity-50">|</span> {tokens.toLocaleString()}
                    </div>
                  </div>
                );
              })}
              {availableProviders.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No usage data found.
                </div>
              )}
            </div>

            {/* Chart Area */}
            <div className="md:col-span-3">
              <div className="space-y-4">
                <TokenUsageChart data={chartData} type="provider" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
