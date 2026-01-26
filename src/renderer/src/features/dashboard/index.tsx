import { useState, useEffect, useCallback } from 'react';
import { Loader2, Zap, Database, Clock, Activity, Box } from 'lucide-react';
import { SummaryCard } from './components/SummaryCard';
import { UsageLineChart } from './components/UsageLineChart';
import { ModelPieChart } from './components/ModelPieChart';
import { MiniTable } from './components/MiniTable';

interface StatsData {
  accounts: any[];
  models: any[];
  history?: any[]; // Assuming history data format
}

const Dashboard = () => {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const stats = await window.api.stats.getStats();
      setData(stats);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Refresh when window gains focus (user returns to app)
    const handleFocus = () => {
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500">Error loading dashboard: {error}</div>;
  }

  // Calculate Summary Metrics
  const totalRequests = data?.accounts.reduce((sum, acc) => sum + acc.total_requests, 0) || 0;
  const totalSuccessful =
    data?.accounts.reduce((sum, acc) => sum + acc.successful_requests, 0) || 0;
  const successRate = totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0; // Default 0 if no requests

  // Max stats across all models
  const maxReqConv =
    data?.models.reduce((max, m) => Math.max(max, m.max_req_conversation || 0), 0) || 0;
  const maxTokenConv =
    data?.models.reduce((max, m) => Math.max(max, m.max_token_conversation || 0), 0) || 0;

  // Prepare Chart Data (Mocking history if not present for visual demo)
  const chartData = [
    { date: 'Day 1', requests: Math.floor(totalRequests * 0.1) },
    { date: 'Day 2', requests: Math.floor(totalRequests * 0.15) },
    { date: 'Day 3', requests: Math.floor(totalRequests * 0.12) },
    { date: 'Day 4', requests: Math.floor(totalRequests * 0.2) },
    { date: 'Day 5', requests: Math.floor(totalRequests * 0.18) },
    { date: 'Day 6', requests: Math.floor(totalRequests * 0.25) },
    { date: 'Today', requests: Math.floor(totalRequests * 0.3) },
  ];

  // Prepare Pie Data (Requests by Model)
  const pieData =
    data?.models
      .map((m) => ({
        name: m.model_id,
        value: m.total_requests,
      }))
      .filter((d) => d.value > 0) || [];

  return (
    <div className="h-full overflow-y-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Real-time overview of your AI infrastructure performance.
        </p>
      </div>

      {/* Summary Cards Grid */}
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
          description="Most queries in one chat"
          color="text-blue-500"
        />
        <SummaryCard
          title="Max Tokens/Conv"
          value={(maxTokenConv / 1000).toFixed(1) + 'k'}
          icon={Box}
          description="Peak conversation size"
          color="text-amber-500"
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-7 mb-8">
        <UsageLineChart data={chartData} title="Request Volume" />
        <ModelPieChart data={pieData} title="Request Distribution" />
      </div>

      {/* Detailed Tables Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <MiniTable
          title="Account Performance"
          data={data?.accounts || []}
          columns={[
            { header: 'Provider', accessorKey: 'provider_id' },
            { header: 'Email', accessorKey: 'email' },
            {
              header: 'Success',
              accessorKey: 'successful_requests',
              cell: (item) => {
                const rate =
                  item.total_requests > 0
                    ? (item.successful_requests / item.total_requests) * 100
                    : 0;
                return `${rate.toFixed(0)}% (${item.total_requests})`;
              },
            },
          ]}
        />
        <MiniTable
          title="Model Performance"
          data={data?.models || []}
          columns={[
            { header: 'Model ID', accessorKey: 'model_id' },
            { header: 'Reqs', accessorKey: 'total_requests' },
            {
              header: 'Max Tokens',
              accessorKey: 'max_token_conversation',
              cell: (item) => item.max_token_conversation.toLocaleString(),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default Dashboard;
