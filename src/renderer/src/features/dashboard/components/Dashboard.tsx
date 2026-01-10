import { useState, useEffect } from 'react';
import { BarChart3, Users, Zap, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalAccounts: 0,
    activeAccounts: 0,
    todayRequests: 0,
    todayTokens: 0,
  });
  const [dailyHistory, setDailyHistory] = useState<any[]>([]);
  const [activeAccountList, setActiveAccountList] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
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
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

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
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${acc.provider === 'Claude' ? 'bg-orange-500' : 'bg-blue-500'}`}
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate">
                      {acc.email || acc.name || 'Unnamed Account'}
                    </span>
                    <span className="text-xs text-muted-foreground">{acc.provider}</span>
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
    </div>
  );
};

export default Dashboard;
