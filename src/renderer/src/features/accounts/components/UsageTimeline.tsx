import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface TimelineDataPoint {
  date: string;
  requests: number;
  tokens: number;
  errors: number;
  avgResponseTime: number;
}

interface UsageTimelineProps {
  accountId: string;
}

export const UsageTimeline = ({ accountId }: UsageTimelineProps) => {
  const [timeline, setTimeline] = useState<TimelineDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 30>(7);

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true);
      try {
        // @ts-ignore
        const response = await window.api.logs.getTimeline({ accountId, days });
        if (response.success) {
          setTimeline(response.timeline);
        }
      } catch (error) {
        console.error('Failed to fetch timeline:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [accountId, days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading timeline...</div>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">No timeline data available</div>
      </div>
    );
  }

  const maxRequests = Math.max(...timeline.map((d) => d.requests), 1);
  const maxTokens = Math.max(...timeline.map((d) => d.tokens), 1);

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Time Range:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setDays(7)}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-8 px-3',
              days === 7
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
            )}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDays(30)}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-8 px-3',
              days === 30
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
            )}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests Chart */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Requests</h3>
          <div className="space-y-3">
            {timeline.map((point) => (
              <div key={point.date} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(point.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="font-mono font-medium">{point.requests}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${(point.requests / maxRequests) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tokens Chart */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Tokens</h3>
          <div className="space-y-3">
            {timeline.map((point) => (
              <div key={point.date} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(point.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="font-mono font-medium">{point.tokens.toLocaleString()}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all"
                    style={{ width: `${(point.tokens / maxTokens) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Requests</p>
            <p className="text-2xl font-bold mt-1">
              {timeline.reduce((sum, point) => sum + point.requests, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Tokens</p>
            <p className="text-2xl font-bold mt-1">
              {timeline.reduce((sum, point) => sum + point.tokens, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Errors</p>
            <p className="text-2xl font-bold mt-1">
              {timeline.reduce((sum, point) => sum + point.errors, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Response Time</p>
            <p className="text-2xl font-bold mt-1">
              {timeline.length > 0
                ? (
                    timeline.reduce((sum, point) => sum + point.avgResponseTime, 0) /
                    timeline.length
                  ).toFixed(0)
                : 0}
              ms
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
