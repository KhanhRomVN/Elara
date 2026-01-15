import { Account } from '../../playground/types';

export interface TokenUsageData {
  date: string; // ISO date string YYYY-MM-DD
  timestamp: number;
  tokens: number;
  provider: string;
}

export interface AggregatedUsage {
  total: number;
  total: number;
  byProvider: Record<string, number>;
  requestsByProvider: Record<string, number>;
  history: {
    label: string; // "10:00", "Mon", "Jan 1" depending on view
    timestamp: number;
    total: number;
    byProvider: Record<string, number>;
  }[];
}

export const fetchAllHistory = async (
  accounts: Account[],
  lastTimestamp: number = 0,
): Promise<TokenUsageData[]> => {
  const allUsage: TokenUsageData[] = [];

  for (const account of accounts) {
    if (account.status !== 'Active') continue;
    // Currently only DeepSeek supports detailed token usage extraction from history
    if (account.provider !== 'DeepSeek') continue;

    try {
      // @ts-ignore
      const status = await window.api.server.start();
      const port = status.port || 11434;

      const endpoint = getEndpoint(account.provider, port);
      const res = await fetch(`${endpoint}?email=${encodeURIComponent(account.email)}`);

      if (!res.ok) continue;

      const data = await res.json();
      const providerUsage = await parseHistory(
        data,
        account.provider,
        account.email,
        port,
        lastTimestamp,
      );
      allUsage.push(...providerUsage);
    } catch (e) {
      console.error(`Failed to fetch history for ${account.provider}:`, e);
    }
  }

  return allUsage.sort((a, b) => a.timestamp - b.timestamp);
};

const getEndpoint = (provider: string, port: number) => {
  switch (provider) {
    case 'DeepSeek':
      return `http://localhost:${port}/v1/deepseek/sessions`;
    case 'Claude':
      return `http://localhost:${port}/v1/claude/conversations`;
    case 'Mistral':
      return `http://localhost:${port}/v1/mistral/conversations`;
    case 'Kimi':
      return `http://localhost:${port}/v1/kimi/conversations`;
    case 'Qwen':
      return `http://localhost:${port}/v1/qwen/conversations`;
    case 'Cohere':
      return `http://localhost:${port}/v1/cohere/conversations`;
    case 'Perplexity':
      return `http://localhost:${port}/v1/perplexity/conversations`;
    case 'Groq':
      return `http://localhost:${port}/v1/groq/conversations`;
    case 'Antigravity':
      return `http://localhost:${port}/v1/antigravity/conversations`;
    // Add others as needed
    default:
      return `http://localhost:${port}/v1/deepseek/sessions`;
  }
};

const parseHistory = async (
  data: any[],
  provider: string,
  email: string,
  port: number,
  lastTimestamp: number,
): Promise<TokenUsageData[]> => {
  const usage: TokenUsageData[] = [];

  if (provider === 'DeepSeek') {
    // DeepSeek returns sessions list, we need to fetch messages for each session to get accurate usage
    // Or check if session object has usage summary (rarely).
    // The previous analysis showed usage in 'chat_messages'.
    // Fetching all messages for all sessions might be heavy.
    // Let's see if we can optimize or if we must do it.
    // For now, let's assume we iterate recent sessions.

    // Actually, strictly speaking, we should fetch detailed messages for exact count.
    // But for "dashboard", maybe we limit to last X sessions or fetch in parallel (with limit).
    // Let's try fetching details for recent 20 sessions?
    // OR: does the session list response contain usage?
    // Usually it doesn't.
    // Let's implement a fetch for detail.

    const sessions = data || [];
    // Process in batches to avoid overwhelming local server
    const batchSize = 5;

    // Sort sessions by update time desc to quickly filter?
    // Usually they come sorted or random. Let's filter first.
    // If we have lastTimestamp, we only need sessions updated AFTER it.
    const newSessions = sessions.filter((s: any) => s.updated_at * 1000 > lastTimestamp);

    if (newSessions.length === 0) return []; // No new data

    for (let i = 0; i < newSessions.length; i += batchSize) {
      const batch = newSessions.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (session: any) => {
          try {
            const detailRes = await fetch(
              `http://localhost:${port}/v1/deepseek/sessions/${session.id}/messages?email=${encodeURIComponent(email)}`,
            );
            if (detailRes.ok) {
              const detail = await detailRes.json();
              if (detail.chat_messages) {
                const sessionTotal = detail.chat_messages.reduce(
                  (acc: number, msg: any) => acc + (msg.accumulated_token_usage || 0),
                  0,
                );
                if (sessionTotal > 0) {
                  usage.push({
                    date: new Date(session.updated_at * 1000).toISOString(),
                    timestamp: session.updated_at * 1000,
                    tokens: sessionTotal,
                    provider: 'DeepSeek',
                  });
                }
              }
            }
          } catch (e) {
            console.error('Error fetching deepseek session detail', e);
          }
        }),
      );
    }
  } else {
    // For other providers, we might rely on what's in the list or just count items
    // Current implementations for others might not strictly store token usage in list response.
    // If we don't have it, we might skip or estimate (e.g., 0).
    // Let's leave them as 0 for now unless we find fields.
  }

  return usage;
};

export const aggregateUsage = (
  data: TokenUsageData[],
  viewMode: 'day' | 'week' | 'month',
): AggregatedUsage => {
  const now = new Date();
  let filteredData = data;
  let labels: string[] = [];
  let formatLabel: (date: Date) => string;

  if (viewMode === 'day') {
    // Last 24 hours
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    filteredData = data.filter((d) => d.timestamp >= start.getTime());
    formatLabel = (d) => `${d.getHours()}:00`;
  } else if (viewMode === 'week') {
    // Last 7 days
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filteredData = data.filter((d) => d.timestamp >= start.getTime());
    formatLabel = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  } else {
    // Last 30 days
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filteredData = data.filter((d) => d.timestamp >= start.getTime());
    formatLabel = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  }

  const buckets: Record<
    string,
    { total: number; byProvider: Record<string, number>; timestamp: number }
  > = {};

  filteredData.forEach((item) => {
    const date = new Date(item.timestamp);
    const label = formatLabel(date);

    if (!buckets[label]) {
      buckets[label] = { total: 0, byProvider: {}, timestamp: item.timestamp }; // approximate timestamp for sort
    }

    buckets[label].total += item.tokens;
    buckets[label].byProvider[item.provider] =
      (buckets[label].byProvider[item.provider] || 0) + item.tokens;
  });

  // Convert to array and sort
  // For charts we often want contiguous buckets even if empty,
  // but for now let's just return what we have, sorted.
  // Ideally we fill gaps.

  const history = Object.entries(buckets)
    .map(([label, val]) => ({
      label,
      ...val,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Fill in gaps logic could go here if needed...

  const total = filteredData.reduce((acc, curr) => acc + curr.tokens, 0);
  const byProvider: Record<string, number> = {};
  const requestsByProvider: Record<string, number> = {};

  filteredData.forEach((d) => {
    byProvider[d.provider] = (byProvider[d.provider] || 0) + d.tokens;
    requestsByProvider[d.provider] = (requestsByProvider[d.provider] || 0) + 1;
  });

  return {
    total,
    byProvider,
    requestsByProvider,
    history,
  };
};
