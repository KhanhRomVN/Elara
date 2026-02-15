import { getDb } from './db';
import { createLogger } from '../utils/logger';

const logger = createLogger('StatsService');

interface DateComponents {
  year: number;
  month: number;
  week: number;
  day: number;
}

function getCurrentGMTComponents(): DateComponents {
  const now = new Date();
  // Get time in GMT
  const gmtNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

  return {
    year: gmtNow.getUTCFullYear(),
    month: gmtNow.getUTCMonth() + 1, // 1-12
    // Simple week calculation: days since epoch / 7
    week: Math.floor(gmtNow.getTime() / (1000 * 60 * 60 * 24 * 7)),
    day: Math.floor(gmtNow.getTime() / (1000 * 60 * 60 * 24)),
  };
}

function isStatsEnabled(): boolean {
  const db = getDb();
  try {
    const row = db
      .prepare("SELECT value FROM config WHERE key = 'enable_stats_collection'")
      .get() as any;
    return row?.value === 'true';
  } catch (error) {
    return true; // Default to true if not found or table doesn't exist
  }
}

export async function recordRequest(
  accountId: string,
  providerId: string,
  modelId: string,
  conversationId?: string,
) {
  if (!isStatsEnabled()) {
    console.log('[Stats] Stats collection disabled');
    return;
  }
  console.log('[Stats] Recording request for', accountId, providerId, modelId);
  const db = getDb();
  const now = Date.now();

  try {
    // 1. Update Account Stats
    // Removed total_requests update

    // 2. Upsert Provider Model Stats (Dọn dẹp các trường max_...)
    db.prepare(
      `
      INSERT INTO provider_models (
        provider_id, model_id, model_name, updated_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(provider_id, model_id) DO UPDATE SET
        updated_at = excluded.updated_at
    `,
    ).run(providerId, modelId, modelId, now);

    // 3. Track Conversation Stats (Max Request Check) - Removed
  } catch (error) {
    logger.error('Error updating request stats:', error);
  }
}

// Helper to record conversation stats: removed

export async function recordSuccess(
  accountId: string,
  providerId: string,
  modelId: string,
  tokens: number,
  conversationId?: string,
) {
  if (!isStatsEnabled()) return;
  console.log('[Stats] Recording success for', accountId, tokens);
  const db = getDb();
  const now = Date.now();

  try {
    // 1. Update Account Success Stats
    // Removed successful_requests update

    // 2. Upsert Provider Models
    db.prepare(
      `
      INSERT INTO provider_models (
        provider_id, model_id, model_name, updated_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(provider_id, model_id) DO UPDATE SET
        updated_at = excluded.updated_at
    `,
    ).run(providerId, modelId, modelId, now);

    // 3. Track Conversation Stats: removed (conversation_stats)
  } catch (error) {
    logger.error('Error updating success stats:', error);
  }

  // Record to metrics table
  recordMetric(accountId, providerId, modelId, tokens, conversationId);
}

export function recordMetric(
  accountId: string,
  providerId: string,
  modelId: string,
  tokens: number,
  conversationId?: string,
) {
  if (!isStatsEnabled()) return;
  const db = getDb();
  const now = Date.now();

  try {
    db.prepare(
      `
      INSERT INTO metrics (provider_id, model_id, account_id, conversation_id, total_tokens, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(providerId, modelId, accountId, conversationId || null, tokens, now);
  } catch (error) {
    logger.error('Error recording metric:', error);
  }
}

export function getUsageHistory(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  offset: number = 0,
) {
  const db = getDb();
  let startTime: number;
  let endTime: number = Date.now();
  let groupBy: string;
  let dateFormat: string;

  const now = new Date();

  switch (period) {
    case 'year':
      // Show 12 months. Offset is in years.
      const targetYear = now.getFullYear() - offset;
      startTime = new Date(targetYear, 0, 1).getTime();
      endTime = new Date(targetYear, 11, 31, 23, 59, 59).getTime();
      groupBy = '%Y-%m';
      dateFormat = '%Y-%m';
      break;
    case 'month':
      // Show all days in a month. Offset is in months.
      const targetMonthDate = new Date(
        now.getFullYear(),
        now.getMonth() - offset,
        1,
      );
      startTime = targetMonthDate.getTime();
      endTime = new Date(
        targetMonthDate.getFullYear(),
        targetMonthDate.getMonth() + 1,
        0,
        23,
        59,
        59,
      ).getTime();
      groupBy = '%Y-%m-%d';
      dateFormat = '%Y-%m-%d';
      break;
    case 'week':
      // Show 7 days. Offset is in weeks.
      const weekStart = new Date(
        now.getTime() - (offset * 7 + 6) * 24 * 60 * 60 * 1000,
      );
      weekStart.setHours(0, 0, 0, 0);
      startTime = weekStart.getTime();
      endTime = startTime + 7 * 24 * 60 * 60 * 1000 - 1;
      groupBy = '%Y-%m-%d';
      dateFormat = '%Y-%m-%d';
      break;
    case 'day':
    default:
      // Show 24 hours. Offset is in days.
      const dayStart = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      startTime = dayStart.getTime();
      endTime = dayStart.getTime() + 24 * 60 * 60 * 1000 - 1;
      groupBy = '%Y-%m-%d %H:00';
      dateFormat = '%H:00';
      break;
  }

  try {
    const rows = db
      .prepare(
        `
      SELECT
        strftime(?, datetime(timestamp / 1000, 'unixepoch', 'localtime')) as date,
        COUNT(*) as requests,
        SUM(total_tokens) as tokens
      FROM metrics
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY date
      ORDER BY date ASC
    `,
      )
      .all(groupBy, startTime, endTime) as any[];

    // Post-process to fix date display for chart
    return rows.map((row) => ({
      ...row,
      date: period === 'day' ? row.date.split(' ')[1] : row.date,
    }));
  } catch (error) {
    logger.error('Error getting usage history:', error);
    return [];
  }
}

export function getAccountStatsByPeriod(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  offset: number = 0,
) {
  const db = getDb();
  const { startTime, endTime } = getTimeRange(period, offset);

  return db
    .prepare(
      `
    SELECT
      a.id, a.email, a.provider_id,
      COUNT(m.id) as total_requests,
      SUM(CASE WHEN m.total_tokens > 0 THEN 1 ELSE 0 END) as successful_requests,
      SUM(m.total_tokens) as total_tokens
    FROM accounts a
    LEFT JOIN metrics m ON a.id = m.account_id AND m.timestamp >= ? AND m.timestamp <= ?
    GROUP BY a.id, a.email, a.provider_id
    ORDER BY total_requests DESC
  `,
    )
    .all(startTime, endTime);
}

export function getModelStatsByPeriod(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  offset: number = 0,
) {
  const db = getDb();
  const { startTime, endTime } = getTimeRange(period, offset);

  return db
    .prepare(
      `
    SELECT
      m.model_id, m.provider_id,
      COUNT(met.id) as total_requests,
      SUM(met.total_tokens) as total_tokens,
      MAX(met.total_tokens) as max_tokens
    FROM provider_models m
    LEFT JOIN metrics met ON m.model_id = met.model_id AND met.timestamp >= ? AND met.timestamp <= ?
    GROUP BY m.model_id, m.provider_id
    ORDER BY total_requests DESC
  `,
    )
    .all(startTime, endTime);
}

function getTimeRange(period: string, offset: number) {
  const now = new Date();
  let startTime: number;
  let endTime: number = Date.now();

  switch (period) {
    case 'year':
      const targetYear = now.getFullYear() - offset;
      startTime = new Date(targetYear, 0, 1).getTime();
      endTime = new Date(targetYear, 11, 31, 23, 59, 59).getTime();
      break;
    case 'month':
      const targetMonthDate = new Date(
        now.getFullYear(),
        now.getMonth() - offset,
        1,
      );
      startTime = targetMonthDate.getTime();
      endTime = new Date(
        targetMonthDate.getFullYear(),
        targetMonthDate.getMonth() + 1,
        0,
        23,
        59,
        59,
      ).getTime();
      break;
    case 'week':
      const weekStart = new Date(
        now.getTime() - (offset * 7 + 6) * 24 * 60 * 60 * 1000,
      );
      weekStart.setHours(0, 0, 0, 0);
      startTime = weekStart.getTime();
      endTime = startTime + 7 * 24 * 60 * 60 * 1000 - 1;
      break;
    default:
      const dayStart = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      startTime = dayStart.getTime();
      endTime = dayStart.getTime() + 24 * 60 * 60 * 1000 - 1;
      break;
  }
  return { startTime, endTime };
}
