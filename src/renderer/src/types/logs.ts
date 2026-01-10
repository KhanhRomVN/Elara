export interface RequestLog {
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
  duration: number; // milliseconds
}

export interface UsageStatistics {
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  averageResponseTime: number;
  errorRate: number;
  lastActivity: string;
}

export interface TimelineData {
  date: string;
  requests: number;
  tokens: number;
  errors: number;
}

export interface DailyUsage extends TimelineData {
  hourlyBreakdown: Array<{
    hour: number;
    requests: number;
    tokens: number;
  }>;
}

export interface MonthlyUsage {
  month: string;
  totalRequests: number;
  totalTokens: number;
  dailyData: TimelineData[];
}
