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

export async function recordRequest(accountId: string, providerId: string) {
  if (!isStatsEnabled()) return;
  const db = getDb();
  const components = getCurrentGMTComponents();

  try {
    // Update Account Stats
    db.prepare(
      `
      INSERT INTO accounts_stats (account_id, total_requests, year_requests, month_requests, week_requests, day_requests, last_reset_year, last_reset_month, last_reset_week, last_reset_day)
      VALUES (?, 1, 1, 1, 1, 1, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        year_requests = CASE WHEN last_reset_year != excluded.last_reset_year THEN 1 ELSE year_requests + 1 END,
        month_requests = CASE WHEN last_reset_month != excluded.last_reset_month THEN 1 ELSE month_requests + 1 END,
        week_requests = CASE WHEN last_reset_week != excluded.last_reset_week THEN 1 ELSE week_requests + 1 END,
        day_requests = CASE WHEN last_reset_day != excluded.last_reset_day THEN 1 ELSE day_requests + 1 END,
        total_requests = total_requests + 1,
        last_reset_year = excluded.last_reset_year,
        last_reset_month = excluded.last_reset_month,
        last_reset_week = excluded.last_reset_week,
        last_reset_day = excluded.last_reset_day
    `,
    ).run(
      accountId,
      components.year,
      components.month,
      components.week,
      components.day,
    );

    // Update Provider Stats
    db.prepare(
      `
      INSERT INTO providers_stats (provider_id, total_requests, year_requests, month_requests, week_requests, day_requests, last_reset_year, last_reset_month, last_reset_week, last_reset_day)
      VALUES (?, 1, 1, 1, 1, 1, ?, ?, ?, ?)
      ON CONFLICT(provider_id) DO UPDATE SET
        year_requests = CASE WHEN last_reset_year != excluded.last_reset_year THEN 1 ELSE year_requests + 1 END,
        month_requests = CASE WHEN last_reset_month != excluded.last_reset_month THEN 1 ELSE month_requests + 1 END,
        week_requests = CASE WHEN last_reset_week != excluded.last_reset_week THEN 1 ELSE week_requests + 1 END,
        day_requests = CASE WHEN last_reset_day != excluded.last_reset_day THEN 1 ELSE day_requests + 1 END,
        total_requests = total_requests + 1,
        last_reset_year = excluded.last_reset_year,
        last_reset_month = excluded.last_reset_month,
        last_reset_week = excluded.last_reset_week,
        last_reset_day = excluded.last_reset_day
    `,
    ).run(
      providerId,
      components.year,
      components.month,
      components.week,
      components.day,
    );
  } catch (error) {
    logger.error('Error updating request stats:', error);
  }
}

export async function recordSuccess(
  accountId: string,
  providerId: string,
  tokens: number,
) {
  if (!isStatsEnabled()) return;
  const db = getDb();
  const components = getCurrentGMTComponents();

  try {
    // Update Account Tokens and Successful Requests
    db.prepare(
      `
      UPDATE accounts_stats SET
        year_tokens = CASE WHEN last_reset_year != ? THEN ? ELSE year_tokens + ? END,
        month_tokens = CASE WHEN last_reset_month != ? THEN ? ELSE month_tokens + ? END,
        week_tokens = CASE WHEN last_reset_week != ? THEN ? ELSE week_tokens + ? END,
        day_tokens = CASE WHEN last_reset_day != ? THEN ? ELSE day_tokens + ? END,
        total_tokens = total_tokens + ?,
        successful_requests = successful_requests + 1,
        last_reset_year = ?,
        last_reset_month = ?,
        last_reset_week = ?,
        last_reset_day = ?
      WHERE account_id = ?
    `,
    ).run(
      components.year,
      tokens,
      tokens,
      components.month,
      tokens,
      tokens,
      components.week,
      tokens,
      tokens,
      components.day,
      tokens,
      tokens,
      tokens,
      components.year,
      components.month,
      components.week,
      components.day,
      accountId,
    );

    // Update Provider Tokens and Successful Requests
    db.prepare(
      `
      UPDATE providers_stats SET
        year_tokens = CASE WHEN last_reset_year != ? THEN ? ELSE year_tokens + ? END,
        month_tokens = CASE WHEN last_reset_month != ? THEN ? ELSE month_tokens + ? END,
        week_tokens = CASE WHEN last_reset_week != ? THEN ? ELSE week_tokens + ? END,
        day_tokens = CASE WHEN last_reset_day != ? THEN ? ELSE day_tokens + ? END,
        total_tokens = total_tokens + ?,
        successful_requests = successful_requests + 1,
        last_reset_year = ?,
        last_reset_month = ?,
        last_reset_week = ?,
        last_reset_day = ?
      WHERE provider_id = ?
    `,
    ).run(
      components.year,
      tokens,
      tokens,
      components.month,
      tokens,
      tokens,
      components.week,
      tokens,
      tokens,
      components.day,
      tokens,
      tokens,
      tokens,
      components.year,
      components.month,
      components.week,
      components.day,
      providerId,
    );
  } catch (error) {
    logger.error('Error updating success stats:', error);
  }
}
