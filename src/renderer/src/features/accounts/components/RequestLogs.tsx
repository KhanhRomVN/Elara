import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface RequestLog {
  id: string;
  accountId: string;
  timestamp: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: any;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
  };
  duration: number;
}

interface RequestLogsProps {
  accountId: string;
}

export const RequestLogs = ({ accountId }: RequestLogsProps) => {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<number | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const options: any = { page, limit: 50 };
        if (statusFilter) {
          options.statusCode = statusFilter;
        }

        // @ts-ignore
        const response = await window.api.logs.getByAccount({ accountId, options });
        if (response.success) {
          setLogs(response.logs);
          setTotal(response.total);
          setTotalPages(response.totalPages);
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [accountId, page, statusFilter]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    if (status >= 400 && status < 500) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
    if (status >= 500) return 'text-red-600 bg-red-100 dark:bg-red-900/20';
    return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Filter by status:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter(null)}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors h-7 px-3',
              statusFilter === null
                ? 'bg-primary text-primary-foreground'
                : 'border border-input bg-background hover:bg-accent',
            )}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter(200)}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors h-7 px-3',
              statusFilter === 200
                ? 'bg-green-600 text-white'
                : 'border border-input bg-background hover:bg-accent',
            )}
          >
            2xx
          </button>
          <button
            onClick={() => setStatusFilter(400)}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors h-7 px-3',
              statusFilter === 400
                ? 'bg-orange-600 text-white'
                : 'border border-input bg-background hover:bg-accent',
            )}
          >
            4xx
          </button>
          <button
            onClick={() => setStatusFilter(500)}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors h-7 px-3',
              statusFilter === 500
                ? 'bg-red-600 text-white'
                : 'border border-input bg-background hover:bg-accent',
            )}
          >
            5xx
          </button>
        </div>
        <span className="text-sm text-muted-foreground ml-auto">
          Showing {logs.length} of {total} logs
        </span>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No logs found
            {statusFilter && ' for this filter'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b bg-muted/50">
                <tr>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-left w-12"></th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-left">
                    Timestamp
                  </th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-left">
                    Method
                  </th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-left">
                    Endpoint
                  </th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-left">
                    Status
                  </th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-left">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="p-4 align-middle">
                        {expandedId === log.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="p-4 align-middle font-mono text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4 align-middle">
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          {log.request.method}
                        </span>
                      </td>
                      <td className="p-4 align-middle font-mono text-xs max-w-md truncate">
                        {log.request.url}
                      </td>
                      <td className="p-4 align-middle">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                            getStatusColor(log.response.status),
                          )}
                        >
                          {log.response.status}
                        </span>
                      </td>
                      <td className="p-4 align-middle font-mono text-xs">{log.duration}ms</td>
                    </tr>
                    {expandedId === log.id && (
                      <tr className="bg-muted/30">
                        <td colSpan={6} className="p-4">
                          <div className="space-y-4">
                            {/* Request */}
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Request</h4>
                              <div className="bg-background rounded-md p-3 space-y-2">
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    URL:
                                  </span>
                                  <pre className="text-xs font-mono mt-1 whitespace-pre-wrap break-all">
                                    {log.request.url}
                                  </pre>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Body:
                                  </span>
                                  <pre className="text-xs font-mono mt-1 bg-muted/50 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(log.request.body, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>

                            {/* Response */}
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Response</h4>
                              <div className="bg-background rounded-md p-3 space-y-2">
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Status:
                                  </span>
                                  <span className="text-xs font-mono ml-2">
                                    {log.response.status} {log.response.statusText}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Body:
                                  </span>
                                  <pre className="text-xs font-mono mt-1 bg-muted/50 p-2 rounded overflow-x-auto max-h-96">
                                    {JSON.stringify(log.response.body, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
