import { Account } from '../../playground/types';
import { fetchProviders, findProvider } from '../../../config/providers';

export interface TokenUsageData {
  date: string; // ISO date string YYYY-MM-DD
  timestamp: number;
  tokens: number;
  provider: string;
}

export interface AggregatedUsage {
  total: number;
  byProvider: Record<string, number>;
  requestsByProvider: Record<string, number>;
  history: {
    label: string; // "10:00", "Mon",
    timestamp: number;
    total: number;
    byProvider: Record<string, number>;
  }[];
}

// Helper to determine if we should look for messages in separate requests
const isDetailFetchRequired = async (providerId: string): Promise<boolean> => {
  const providers = await fetchProviders();
  const config = findProvider(providers, providerId);
  return config?.detail_fetch_required ?? false;
};

export const fetchAllHistory = async (
  accounts: Account[],
  lastTimestamp: number = 0,
): Promise<TokenUsageData[]> => {
  const allUsage: TokenUsageData[] = [];

  for (const account of accounts) {
    if (account.status !== 'Active') continue;

    try {
      const status = await window.api.server.start();
      const port = status.port || 11434;

      // Standardize usage of "sessions" or "conversations" endpoint
      // The backend maps both to the same logic essentially
      const endpoint = `http://localhost:${port}/v1/providers/${account.provider_id}/conversations`;

      const res = await fetch(`${endpoint}?email=${encodeURIComponent(account.email)}`);
      if (!res.ok) continue;

      const data = await res.json();

      const providerUsage = await parseHistory(
        data,
        account.provider_id,
        account.email,
        port,
        lastTimestamp,
      );
      allUsage.push(...providerUsage);
    } catch (e) {
      console.error(`Failed to fetch history for ${account.provider_id}:`, e);
    }
  }

  return allUsage.sort((a, b) => a.timestamp - b.timestamp);
};

const parseHistory = async (
  data: any[],
  providerId: string,
  email: string,
  port: number,
  lastTimestamp: number,
): Promise<TokenUsageData[]> => {
  const usage: TokenUsageData[] = [];

  if (await isDetailFetchRequired(providerId)) {
    const sessions = Array.isArray(data) ? data : [];
    const batchSize = 5;
    const newSessions = sessions.filter(
      (s: any) => (s.updated_at || s.updated_at_timestamp || 0) * 1000 > lastTimestamp,
    );

    if (newSessions.length === 0) return [];

    for (let i = 0; i < newSessions.length; i += batchSize) {
      const batch = newSessions.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (session: any) => {
          try {
            // Standard detail endpoint
            const url = `http://localhost:${port}/v1/providers/${providerId}/conversations/${session.id || session.uuid}?email=${encodeURIComponent(email)}`;
            const detailRes = await fetch(url);

            if (detailRes.ok) {
              const detail = await detailRes.json();

              if (detail.chat_messages) {
                const sessionTotal = detail.chat_messages.reduce(
                  (acc: number, msg: any) => acc + (msg.accumulated_token_usage || 0),
                  0,
                );
                if (sessionTotal > 0) {
                  usage.push({
                    date: new Date((session.updated_at || 0) * 1000).toISOString(),
                    timestamp: (session.updated_at || 0) * 1000,
                    tokens: sessionTotal,
                    provider: providerId,
                  });
                }
              }
              // Handle Claude/Others structure if they return direct usage in detail
              else if (detail.usage) {
                // Adapt based on actual Claude response structure if needed
              }
            }
          } catch (e) {
            console.error(`Error fetching session detail for ${providerId}`, e);
          }
        }),
      );
    }
  }

  return usage;
};

export const aggregateUsage = (
  data: TokenUsageData[],
  viewMode: 'day' | 'week' | 'month',
): AggregatedUsage => {
  const now = new Date();
  let filteredData = data;
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
      buckets[label] = { total: 0, byProvider: {}, timestamp: item.timestamp };
    }

    buckets[label].total += item.tokens;
    buckets[label].byProvider[item.provider] =
      (buckets[label].byProvider[item.provider] || 0) + item.tokens;
  });

  const history = Object.entries(buckets)
    .map(([label, val]) => ({
      label,
      ...val,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

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
