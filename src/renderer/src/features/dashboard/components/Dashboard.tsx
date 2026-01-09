import { BarChart3, Users, Zap, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  // Fake Data
  const stats = [
    { title: 'Total Providers', value: '2', icon: Zap, description: 'Active providers' },
    { title: 'Total Accounts', value: '12', icon: Users, description: 'Across all providers' },
    { title: 'Total Usage', value: '1.2M', icon: BarChart3, description: 'Tokens today' },
  ];

  const usageData = [
    { provider: 'Claode', usage: 75 },
    { provider: 'DeepSeek', usage: 45 },
  ];

  const topAccounts = [
    { email: 'main.claude@gmail.com', provider: 'Claude', usage: '450k' },
    { email: 'dev.deepseek@gmail.com', provider: 'DeepSeek', usage: '320k' },
    { email: 'test.claude@gmail.com', provider: 'Claude', usage: '150k' },
    { email: 'backup.deep@gmail.com', provider: 'DeepSeek', usage: '80k' },
    { email: 'temp.user@gmail.com', provider: 'Claude', usage: '25k' },
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
        {stats.map((stat, i) => (
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
            <h3 className="font-semibold leading-none tracking-tight">Daily Usage by Provider</h3>
            <p className="text-sm text-muted-foreground">Token consumption breakdown.</p>
          </div>
          <div className="space-y-4">
            {usageData.map((item) => (
              <div key={item.provider} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.provider}</span>
                  <span className="text-muted-foreground">{item.usage}% active limit</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${item.usage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Accounts */}
        <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5 mb-6">
            <h3 className="font-semibold leading-none tracking-tight">Top Active Accounts</h3>
            <p className="text-sm text-muted-foreground">Highest token consumers today.</p>
          </div>
          <div className="space-y-4">
            {topAccounts.map((acc, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${acc.provider === 'Claude' ? 'bg-orange-500' : 'bg-blue-500'}`}
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate">{acc.email}</span>
                    <span className="text-xs text-muted-foreground">{acc.provider}</span>
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-primary">{acc.usage}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
