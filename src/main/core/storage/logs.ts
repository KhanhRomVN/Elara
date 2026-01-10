import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const LOGS_FILE = path.join(app.getPath('userData'), 'request_logs.json');
const RETENTION_DAYS = 30;

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
  duration: number;
}

// Ensure logs file exists
if (!fs.existsSync(LOGS_FILE)) {
  fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
}

export const logsStorage = {
  // Create a new log entry
  create: (log: Omit<RequestLog, 'id'>): RequestLog => {
    const logs = logsStorage.getAll();
    const newLog: RequestLog = {
      ...log,
      id: crypto.randomUUID(),
    };
    logs.push(newLog);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
    return newLog;
  },

  // Get all logs
  getAll: (): RequestLog[] => {
    try {
      if (!fs.existsSync(LOGS_FILE)) return [];
      const data = fs.readFileSync(LOGS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to read logs:', error);
      return [];
    }
  },

  // Get logs for a specific account with pagination and filters
  getByAccount: (
    accountId: string,
    options?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
      statusCode?: number;
    },
  ): { logs: RequestLog[]; total: number; page: number; totalPages: number } => {
    const allLogs = logsStorage.getAll();

    // Filter by account
    let filtered = allLogs.filter((log) => log.accountId === accountId);

    // Filter by date range
    if (options?.startDate) {
      filtered = filtered.filter((log) => log.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      filtered = filtered.filter((log) => log.timestamp <= options.endDate!);
    }

    // Filter by status code
    if (options?.statusCode) {
      filtered = filtered.filter((log) => log.response.status === options.statusCode);
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Pagination
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = filtered.slice(startIndex, endIndex);

    return {
      logs: paginatedLogs,
      total: filtered.length,
      page,
      totalPages: Math.ceil(filtered.length / limit),
    };
  },

  // Get usage statistics for an account
  getStatistics: (
    accountId: string,
  ): {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    averageResponseTime: number;
    errorRate: number;
    lastActivity: string;
  } => {
    const logs = logsStorage.getAll().filter((log) => log.accountId === accountId);

    if (logs.length === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        averageResponseTime: 0,
        errorRate: 0,
        lastActivity: '',
      };
    }

    const totalRequests = logs.length;
    const totalResponseTime = logs.reduce((sum, log) => sum + log.duration, 0);
    const errorCount = logs.filter((log) => log.response.status >= 400).length;

    // Extract token info from response bodies (provider-specific)
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    logs.forEach((log) => {
      if (log.response.body?.usage) {
        totalInputTokens += log.response.body.usage.prompt_tokens || 0;
        totalOutputTokens += log.response.body.usage.completion_tokens || 0;
      }
    });

    // Sort by timestamp to get last activity
    const sortedLogs = [...logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return {
      totalRequests,
      totalTokens: totalInputTokens + totalOutputTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      averageResponseTime: totalResponseTime / totalRequests,
      errorRate: (errorCount / totalRequests) * 100,
      lastActivity: sortedLogs[0]?.timestamp || '',
    };
  },

  // Get timeline data for an account
  getTimeline: (
    accountId: string,
    days: number = 30,
  ): Array<{
    date: string;
    requests: number;
    tokens: number;
    errors: number;
    avgResponseTime: number;
  }> => {
    const logs = logsStorage.getAll().filter((log) => log.accountId === accountId);

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Filter logs within the date range
    const filteredLogs = logs.filter((log) => new Date(log.timestamp) >= startDate);

    // Group by date
    const dailyData: Record<
      string,
      { requests: number; tokens: number; errors: number; totalDuration: number }
    > = {};

    filteredLogs.forEach((log) => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { requests: 0, tokens: 0, errors: 0, totalDuration: 0 };
      }

      dailyData[date].requests += 1;
      dailyData[date].totalDuration += log.duration;

      if (log.response.status >= 400) {
        dailyData[date].errors += 1;
      }

      // Extract tokens
      if (log.response.body?.usage) {
        const usage = log.response.body.usage;
        dailyData[date].tokens += (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
      }
    });

    // Convert to array and sort by date
    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        requests: data.requests,
        tokens: data.tokens,
        errors: data.errors,
        avgResponseTime: data.totalDuration / data.requests,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  // Cleanup logs older than retention period
  cleanup: (): { removed: number } => {
    const logs = logsStorage.getAll();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    const retained = logs.filter((log) => new Date(log.timestamp) >= cutoffDate);
    const removed = logs.length - retained.length;

    if (removed > 0) {
      fs.writeFileSync(LOGS_FILE, JSON.stringify(retained, null, 2));
      console.log(`[Logs] Cleaned up ${removed} old log entries`);
    }

    return { removed };
  },

  // Delete all logs for a specific account
  deleteByAccount: (accountId: string): { removed: number } => {
    const logs = logsStorage.getAll();
    const retained = logs.filter((log) => log.accountId !== accountId);
    const removed = logs.length - retained.length;

    if (removed > 0) {
      fs.writeFileSync(LOGS_FILE, JSON.stringify(retained, null, 2));
    }

    return { removed };
  },
};

// Schedule daily cleanup
setInterval(
  () => {
    logsStorage.cleanup();
  },
  24 * 60 * 60 * 1000,
); // Run every 24 hours
