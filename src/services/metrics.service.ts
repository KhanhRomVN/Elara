/**
 * ------------------------------------------------------------------
 * Metrics Service
 * ------------------------------------------------------------------
 * Service ghi nhận và truy vấn metrics usage cho các request.
 * Hỗ trợ token counting, record success/error, và thống kê theo thời gian.
 *
 * Main functions:
 * - recordRequest()           : Ghi nhận request
 * - recordSuccess()           : Ghi nhận thành công
 * - recordError()             : Ghi nhận lỗi
 * - recordMetric()            : Ghi nhận metric vào database
 * - recordChatMetrics()       : Ghi nhận metrics cho chat response
 * - getUsageHistory()         : Lấy lịch sử usage theo period
 * - getAccountStatsByPeriod() : Thống kê theo account
 * - getModelStatsByPeriod()   : Thống kê theo model
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getDb } from '../database';

// ── Repositories ──
import {
  insertMetric,
  queryUsageHistory,
  queryAccountStatsByPeriod,
  queryModelStatsByPeriod,
} from '../repositories/metrics.repository';
import { upsertModel, updateModelSuccessRate } from '../repositories/model.repository';

// ── Utils ──
import { createLogger } from '../utils/logger';
import { countMessagesTokens, countTokens } from '../utils/tokenizer';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('MetricsService');

// ─── Record Functions ─────────────────────────────────────────────────

export async function recordRequest(providerId: string, modelId: string) {
  try {
    upsertModel(providerId, modelId, modelId, false, null, Date.now());
  } catch (error) {
    logger.error('Error updating request stats:', error);
  }
}

export async function recordSuccess(
  accountId: string,
  providerId: string,
  modelId: string,
  tokens: number,
) {
  try {
    upsertModel(providerId, modelId, modelId, false, null, Date.now());
  } catch (error) {
    logger.error('Error updating success stats:', error);
  }
  recordMetric(accountId, providerId, modelId, tokens, 'success');
}

export async function recordError(
  accountId: string | undefined,
  providerId: string,
  modelId: string,
  errorMessage?: string,
) {
  try {
    upsertModel(providerId, modelId, modelId, false, null, Date.now());
  } catch (error) {
    logger.error('Error updating error stats:', error);
  }
  recordMetric(accountId || 'anonymous', providerId, modelId, 0, 'error');
  logger.warn(`Recorded error metric for ${providerId}/${modelId}: ${errorMessage || 'unknown error'}`);
}

export function recordMetric(
  accountId: string,
  providerId: string,
  modelId: string,
  tokens: number,
  status: 'success' | 'error' = 'success',
) {
  try {
    insertMetric(providerId, modelId, accountId, tokens, status);
    updateModelSuccessRateAsync(providerId, modelId);
  } catch (error) {
    logger.error('Error recording metric:', error);
  }
}

function updateModelSuccessRateAsync(providerId: string, modelId: string): void {
  setImmediate(() => {
    try {
      const db = getDb();
      const result = db.prepare(`
        SELECT ROUND(
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
          2
        ) as success_rate
        FROM metrics 
        WHERE provider_id = ? AND model_id = ?
      `).get(providerId, modelId);

      const successRate = (result as any)?.success_rate ?? null;
      updateModelSuccessRate(providerId, modelId, successRate);

      const { invalidateProviderCache } = require('./provider.service');
      invalidateProviderCache();
    } catch (error) {
      logger.error(`Error updating success rate for model ${providerId}/${modelId}:`, error);
    }
  });
}

export function recordChatMetrics(
  accountId: string | undefined,
  providerId: string,
  model: string,
  messages: any[],
  accumulatedAssistantContent: string,
): void {
  const requestTokens = countMessagesTokens(messages);
  const responseTokens = countTokens(accumulatedAssistantContent);
  const totalTokens = requestTokens + responseTokens;

  recordSuccess(
    accountId || 'anonymous',
    providerId,
    model || 'unknown',
    totalTokens,
  );

  if (accountId) {
    const { accountRefreshService } = require('./account-refresh.service');
    accountRefreshService.refreshUsage(accountId).catch((err: any) => {
      logger.warn(`Failed to refresh usage for account ${accountId}: ${err.message}`);
    });
  }
}

// ─── Query Helpers ────────────────────────────────────────────────────

interface TimeRange {
  startTime: number;
  endTime: number;
}

function getTimeRange(period: string, offset: number): TimeRange {
  const now = new Date();
  let startTime: number;
  let endTime: number = Date.now();

  switch (period) {
    case 'year': {
      const targetYear = now.getFullYear() - offset;
      startTime = new Date(targetYear, 0, 1).getTime();
      endTime = new Date(targetYear, 11, 31, 23, 59, 59).getTime();
      break;
    }
    case 'month': {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      startTime = targetMonthDate.getTime();
      endTime = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0, 23, 59, 59).getTime();
      break;
    }
    case 'week': {
      const weekStart = new Date(now.getTime() - (offset * 7 + 6) * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      startTime = weekStart.getTime();
      endTime = startTime + 7 * 24 * 60 * 60 * 1000 - 1;
      break;
    }
    default: {
      const dayStart = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      startTime = dayStart.getTime();
      endTime = dayStart.getTime() + 24 * 60 * 60 * 1000 - 1;
      break;
    }
  }
  return { startTime, endTime };
}

export function getUsageHistory(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  offset: number = 0,
  accountId?: string,
) {
  let groupBy: string;
  const labels: string[] = [];

  let startTime: number;
  let endTime: number;

  switch (period) {
    case 'year': {
      const targetYear = now.getFullYear() - offset;
      startTime = new Date(targetYear, 0, 1).getTime();
      endTime = new Date(targetYear, 11, 31, 23, 59, 59, 999).getTime();
      groupBy = '%Y-%m';
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      for (let m = 1; m <= 12; m++) {
        const lbl = `${targetYear}-${String(m).padStart(2, '0')}`;
        if (offset === 0 && lbl > currentMonthStr) break;
        labels.push(lbl);
      }
      break;
    }
    case 'month': {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      startTime = targetMonthDate.getTime();
      const lastDay = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0);
      endTime = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999).getTime();
      groupBy = '%Y-%m-%d';
      const todayStr = now.toISOString().split('T')[0];
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateObj = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), d);
        const lbl = dateObj.toISOString().split('T')[0];
        if (offset === 0 && lbl > todayStr) break;
        labels.push(lbl);
      }
      break;
    }
    case 'week': {
      const endOfPeriod = new Date(now.getTime() - offset * 7 * 24 * 60 * 60 * 1000);
      endOfPeriod.setHours(23, 59, 59, 999);
      const startOfPeriod = new Date(endOfPeriod.getTime() - 6 * 24 * 60 * 60 * 1000);
      startOfPeriod.setHours(0, 0, 0, 0);
      startTime = startOfPeriod.getTime();
      endTime = endOfPeriod.getTime();
      groupBy = '%Y-%m-%d';
      const todayStr = now.toISOString().split('T')[0];
      for (let i = 0; i < 7; i++) {
        const dateObj = new Date(startTime + i * 24 * 60 * 60 * 1000);
        const lbl = dateObj.toISOString().split('T')[0];
        if (offset === 0 && lbl > todayStr) break;
        labels.push(lbl);
      }
      break;
    }
    default: {
      const dayStart = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      startTime = dayStart.getTime();
      endTime = dayStart.getTime() + 24 * 60 * 60 * 1000 - 1;
      groupBy = '%Y-%m-%d %H:00';
      const currentHour = now.getHours();
      for (let h = 0; h < 24; h++) {
        const lbl = `${String(h).padStart(2, '0')}:00`;
        if (offset === 0 && h > currentHour) break;
        labels.push(lbl);
      }
      break;
    }
  }

  try {
    const rows = queryUsageHistory(groupBy, startTime, endTime, accountId);
    const dataMap = new Map<string, any>();
    rows.forEach((row) => {
      const key = period === 'day' ? row.date.split(' ')[1] : row.date;
      dataMap.set(key, row);
    });
    return labels.map((label) => {
      const entry = dataMap.get(label);
      return { date: label, requests: entry?.requests ?? 0, tokens: entry?.tokens ?? 0 };
    });
  } catch (error) {
    logger.error('Error getting usage history:', error);
    return labels.map((label) => ({ date: label, requests: 0, tokens: 0 }));
  }
}

export function getAccountStatsByPeriod(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  offset: number = 0,
  accountId?: string,
) {
  const { startTime, endTime } = getTimeRange(period, offset);
  return queryAccountStatsByPeriod(startTime, endTime, accountId);
}

export function getModelStatsByPeriod(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  offset: number = 0,
) {
  const { startTime, endTime } = getTimeRange(period, offset);
  return queryModelStatsByPeriod(startTime, endTime);
}