import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  averageResponseTime: number;
  errorRate: number;
  lastActivity: string;
}

interface UsageStatisticsProps {
  accountId: string;
}

export const UsageStatistics = ({ accountId }: UsageStatisticsProps) => {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatistics = async () => {
      setLoading(true);
      try {
        // @ts-ignore
        const response = await window.api.logs.getStatistics(accountId);
        if (response.success) {
          setStats(response.statistics);
        }
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [accountId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">No statistics available</div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Requests',
      value: stats.totalRequests.toLocaleString(),
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Total Tokens',
      value: stats.totalTokens.toLocaleString(),
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      subtitle: `${stats.inputTokens.toLocaleString()} in / ${stats.outputTokens.toLocaleString()} out`,
    },
    {
      label: 'Avg Response Time',
      value: `${stats.averageResponseTime.toFixed(0)}ms`,
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: 'Error Rate',
      value: `${stats.errorRate.toFixed(2)}%`,
      icon: stats.errorRate > 5 ? AlertCircle : TrendingDown,
      color: stats.errorRate > 5 ? 'text-red-500' : 'text-purple-500',
      bgColor: stats.errorRate > 5 ? 'bg-red-500/10' : 'bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            {stat.subtitle && <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>}
          </div>
        ))}
      </div>

      {/* Details Table */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Usage Breakdown</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">Input Tokens</span>
              <span className="text-sm font-mono font-medium">
                {stats.inputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">Output Tokens</span>
              <span className="text-sm font-mono font-medium">
                {stats.outputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">Total Tokens</span>
              <span className="text-sm font-mono font-medium">
                {stats.totalTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">
                Average Response Time
              </span>
              <span className="text-sm font-mono font-medium">
                {stats.averageResponseTime.toFixed(2)}ms
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">Error Rate</span>
              <span className="text-sm font-mono font-medium">{stats.errorRate.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Last Activity</span>
              <span className="text-sm font-mono font-medium">
                {stats.lastActivity ? new Date(stats.lastActivity).toLocaleString() : 'No activity'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
