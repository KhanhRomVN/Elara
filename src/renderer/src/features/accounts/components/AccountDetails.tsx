import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Activity, FileText } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { UsageStatistics } from './UsageStatistics';
import { UsageTimeline } from './UsageTimeline';
import { RequestLogs } from './RequestLogs';

interface Account {
  id: string;
  provider: 'Claude' | 'DeepSeek';
  email: string;
  name?: string;
  picture?: string;
}

type TabType = 'statistics' | 'timeline' | 'logs';

export const AccountDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('statistics');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccount = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // @ts-ignore
        const data = await window.api.accounts.getById(id);
        setAccount(data);
      } catch (error) {
        console.error('Failed to fetch account:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Account Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The account you're looking for doesn't exist.
          </p>
          <button
            onClick={() => navigate('/accounts')}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
          >
            Back to Accounts
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'statistics' as TabType, label: 'Statistics', icon: BarChart3 },
    { id: 'timeline' as TabType, label: 'Timeline', icon: Activity },
    { id: 'logs' as TabType, label: 'Request Logs', icon: FileText },
  ];

  return (
    <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/accounts')}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 w-9"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          {account.picture && (
            <img
              src={account.picture}
              alt={account.name || account.email}
              className="w-12 h-12 rounded-full object-cover"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              {account.name && (
                <h2 className="text-2xl font-bold text-foreground">{account.name}</h2>
              )}
              <div
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                  account.provider === 'Claude'
                    ? 'bg-orange-500/10 text-orange-500'
                    : 'bg-blue-500/10 text-blue-500',
                )}
              >
                {account.provider}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{account.email}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 pb-3 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'statistics' && <UsageStatistics accountId={account.id} />}
        {activeTab === 'timeline' && <UsageTimeline accountId={account.id} />}
        {activeTab === 'logs' && <RequestLogs accountId={account.id} />}
      </div>
    </div>
  );
};

export default AccountDetails;
