/**
 * ------------------------------------------------------------------
 * Metrics Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng metrics. Lưu trữ thống kê usage
 * của các request gửi đến provider.
 *
 * Main functions:
 * - insertMetric()              : Ghi nhận metric của một request
 * - queryUsageHistory()         : Lấy lịch sử usage theo khoảng thời gian
 * - queryAccountStatsByPeriod() : Thống kê usage theo account
 * - queryModelStatsByPeriod()   : Thống kê usage theo model
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getDb } from '../database';

// ─── Inserts ────────────────────────────────────────────────────────────

export const insertMetric = (
  providerId: string,
  modelId: string,
  accountId: string,
  totalTokens: number,
  status: 'success' | 'error' = 'success',
  timestamp?: number,
): void => {
  const db = getDb();
  const now = timestamp ?? Date.now();
  db.prepare(
    `INSERT INTO metrics (provider_id, model_id, account_id, status, total_tokens, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(providerId, modelId, accountId, status, totalTokens, now);
};

// ─── Queries ────────────────────────────────────────────────────────────

export const queryUsageHistory = (
  groupBy: string,
  startTime: number,
  endTime: number,
  accountId?: string,
): Array<{ date: string; requests: number; tokens: number }> => {
  const db = getDb();
  let sql = `
    SELECT
      strftime(?, datetime(timestamp / 1000, 'unixepoch', 'localtime')) as date,
      COUNT(*) as requests,
      SUM(total_tokens) as tokens
    FROM metrics
    WHERE timestamp >= ? AND timestamp <= ?
  `;

  const params: any[] = [groupBy, startTime, endTime];

  if (accountId) {
    sql += ` AND account_id = ?`;
    params.push(accountId);
  }

  sql += ` GROUP BY date ORDER BY date ASC`;

  return db.prepare(sql).all(...params) as any[];
};

export const queryAccountStatsByPeriod = (
  startTime: number,
  endTime: number,
  accountId?: string,
): any[] => {
  const db = getDb();
  let sql = `
    SELECT
      a.id, a.email, a.provider_id,
      stats.total_requests,
      stats.successful_requests,
      stats.total_tokens
    FROM accounts a
    LEFT JOIN (
      SELECT account_id,
        COUNT(id) as total_requests,
        SUM(CASE WHEN total_tokens > 0 THEN 1 ELSE 0 END) as successful_requests,
        SUM(total_tokens) as total_tokens
      FROM metrics
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY account_id
    ) stats ON a.id = stats.account_id
  `;

  const params: any[] = [startTime, endTime];

  if (accountId) {
    sql += ` WHERE a.id = ?`;
    params.push(accountId);
  }

  sql += ` ORDER BY total_requests DESC`;

  return db.prepare(sql).all(...params);
};

export const queryModelStatsByPeriod = (
  startTime: number,
  endTime: number,
): any[] => {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        m.model_id, m.provider_id,
        stats.total_requests, stats.total_tokens
       FROM models m
       LEFT JOIN (
         SELECT model_id,
           COUNT(id) as total_requests,
           SUM(total_tokens) as total_tokens
         FROM metrics
         WHERE timestamp >= ? AND timestamp <= ?
         GROUP BY model_id
       ) stats ON m.model_id = stats.model_id
       ORDER BY total_requests DESC`,
    )
    .all(startTime, endTime);
};