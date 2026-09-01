/**
 * ------------------------------------------------------------------
 * Cerebras Cloud Rate Limiter
 * ------------------------------------------------------------------
 * Rate limiter cho Cerebras Cloud API. Theo dõi số request và token
 * consumption theo sliding window (minute, hour, day) cho từng account.
 *
 * Main functions:
 * - checkLimit()    : Kiểm tra xem account có vượt rate limit không
 * - recordRequest() : Ghi nhận một request
 * - recordTokens()  : Ghi nhận token consumption
 * - getUsageSummary(): Lấy tổng quan usage cho account
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { CerebrasUsageData } from './cerebras-cloud.types';

// ── Constants ──
import { RATE_LIMITS, WINDOW_MS } from './cerebras-cloud.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CerebrasRateLimiter');

// ─── Types ──────────────────────────────────────────────────────────────

interface UsageWindow {
  requestTimestamps: number[];
  tokenEntries: Array<{ ts: number; tokens: number }>;
}

interface AccountUsage {
  minute: UsageWindow;
  hour: UsageWindow;
  day: UsageWindow;
}

// ─── Class ──────────────────────────────────────────────────────────────

export class CerebrasUsageTracker {
  private usage: Map<string, AccountUsage> = new Map();

  private getOrCreate(accountId: string): AccountUsage {
    if (!this.usage.has(accountId)) {
      this.usage.set(accountId, {
        minute: { requestTimestamps: [], tokenEntries: [] },
        hour: { requestTimestamps: [], tokenEntries: [] },
        day: { requestTimestamps: [], tokenEntries: [] },
      });
    }
    return this.usage.get(accountId)!;
  }

  /** Xóa các entry đã hết hạn khỏi window */
  private prune(window: UsageWindow, windowMs: number): void {
    const cutoff = Date.now() - windowMs;
    window.requestTimestamps = window.requestTimestamps.filter(
      (ts) => ts > cutoff,
    );
    window.tokenEntries = window.tokenEntries.filter(
      (e) => e.ts > cutoff,
    );
  }

  private countTokens(window: UsageWindow): number {
    return window.tokenEntries.reduce((sum, e) => sum + e.tokens, 0);
  }

  /**
   * Kiểm tra xem account có vượt rate limit không.
   * Trả về null nếu OK, hoặc error message nếu bị giới hạn.
   */
  checkLimit(accountId: string, estimatedTokens: number = 0): string | null {
    const u = this.getOrCreate(accountId);
    const now = Date.now();

    this.prune(u.minute, WINDOW_MS.minute);
    this.prune(u.hour, WINDOW_MS.hour);
    this.prune(u.day, WINDOW_MS.day);

    if (u.minute.requestTimestamps.length >= RATE_LIMITS.requests.perMinute) {
      const oldest = u.minute.requestTimestamps[0];
      const resetIn = Math.ceil((oldest + WINDOW_MS.minute - now) / 1000);
      return `Rate limit exceeded: ${RATE_LIMITS.requests.perMinute} requests/minute. Reset in ${resetIn}s.`;
    }
    if (u.hour.requestTimestamps.length >= RATE_LIMITS.requests.perHour) {
      const oldest = u.hour.requestTimestamps[0];
      const resetIn = Math.ceil((oldest + WINDOW_MS.hour - now) / 1000);
      return `Rate limit exceeded: ${RATE_LIMITS.requests.perHour} requests/hour. Reset in ${resetIn}s.`;
    }
    if (u.day.requestTimestamps.length >= RATE_LIMITS.requests.perDay) {
      const oldest = u.day.requestTimestamps[0];
      const resetIn = Math.ceil((oldest + WINDOW_MS.day - now) / 1000);
      return `Rate limit exceeded: ${RATE_LIMITS.requests.perDay} requests/day. Reset in ${resetIn}s.`;
    }

    if (estimatedTokens > 0) {
      const minuteTokens = this.countTokens(u.minute);
      if (minuteTokens + estimatedTokens > RATE_LIMITS.tokens.perMinute) {
        return `Token limit exceeded: ${RATE_LIMITS.tokens.perMinute.toLocaleString()} tokens/minute (current: ${minuteTokens.toLocaleString()}).`;
      }
      const hourTokens = this.countTokens(u.hour);
      if (hourTokens + estimatedTokens > RATE_LIMITS.tokens.perHour) {
        return `Token limit exceeded: ${RATE_LIMITS.tokens.perHour.toLocaleString()} tokens/hour (current: ${hourTokens.toLocaleString()}).`;
      }
      const dayTokens = this.countTokens(u.day);
      if (dayTokens + estimatedTokens > RATE_LIMITS.tokens.perDay) {
        return `Token limit exceeded: ${RATE_LIMITS.tokens.perDay.toLocaleString()} tokens/day (current: ${dayTokens.toLocaleString()}).`;
      }
    }

    return null;
  }

  recordRequest(accountId: string): void {
    const u = this.getOrCreate(accountId);
    const now = Date.now();
    u.minute.requestTimestamps.push(now);
    u.hour.requestTimestamps.push(now);
    u.day.requestTimestamps.push(now);
  }

  recordTokens(accountId: string, tokens: number): void {
    if (tokens <= 0) return;
    const u = this.getOrCreate(accountId);
    const now = Date.now();
    const entry = { ts: now, tokens };
    u.minute.tokenEntries.push(entry);
    u.hour.tokenEntries.push(entry);
    u.day.tokenEntries.push(entry);
  }

  getUsageSummary(accountId: string): CerebrasUsageData {
    const u = this.getOrCreate(accountId);
    this.prune(u.minute, WINDOW_MS.minute);
    this.prune(u.hour, WINDOW_MS.hour);
    this.prune(u.day, WINDOW_MS.day);

    return {
      requests: {
        minute: { used: u.minute.requestTimestamps.length, limit: RATE_LIMITS.requests.perMinute },
        hour: { used: u.hour.requestTimestamps.length, limit: RATE_LIMITS.requests.perHour },
        day: { used: u.day.requestTimestamps.length, limit: RATE_LIMITS.requests.perDay },
      },
      tokens: {
        minute: { used: this.countTokens(u.minute), limit: RATE_LIMITS.tokens.perMinute },
        hour: { used: this.countTokens(u.hour), limit: RATE_LIMITS.tokens.perHour },
        day: { used: this.countTokens(u.day), limit: RATE_LIMITS.tokens.perDay },
      },
    };
  }
}

// ─── Singleton ─────────────────��────────────────────────────────────────

export const usageTracker = new CerebrasUsageTracker();