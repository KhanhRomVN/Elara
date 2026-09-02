/**
 * ------------------------------------------------------------------
 * Stats Service
 * ------------------------------------------------------------------
 * Service thống kê - wrapper của metrics.service.
 * Cung cấp các hàm thống kê cho stats controller.
 *
 * Main functions:
 * - getModelStatsByPeriod()      : Thống kê theo model
 * - getAccountStatsByPeriod()    : Thống kê theo account
 * - getUsageHistory()            : Lịch sử usage theo period
 * - recordSuccess()              : Ghi nhận thành công (có conversation_id)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import {
  getModelStatsByPeriod as _getModelStatsByPeriod,
  getAccountStatsByPeriod as _getAccountStatsByPeriod,
  getUsageHistory as _getUsageHistory,
  recordSuccess as _recordSuccess,
} from './metrics.service';

// ─── Re-exports ────────────────────────────────────────────────────────

export { getModelStatsByPeriod } from './metrics.service';

// ─── Wrappers ──────────────────────────────────────────────────────────

export const getAccountStatsByPeriod = (
  period: 'day' | 'week' | 'month' | 'year',
  offset: number,
  accountId?: string,
) => _getAccountStatsByPeriod(period, offset, accountId);

export const getUsageHistory = (
  period: 'day' | 'week' | 'month' | 'year',
  offset: number,
  accountId?: string,
) => _getUsageHistory(period, offset, accountId);

export async function recordSuccess(
  accountId: string,
  providerId: string,
  modelId: string,
  tokens: number,
  _conversationId?: string,
): Promise<void> {
  await _recordSuccess(accountId, providerId, modelId, tokens);
}