/**
 * ------------------------------------------------------------------
 * Cerebras Cloud Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Cerebras Cloud provider.
 *
 * Main exports:
 * - BASE_URL            : Base URL của Cerebras Cloud web
 * - API_BASE_URL        : Base URL của Cerebras API
 * - RATE_LIMITS         : Giới hạn rate per minute/hour/day
 * - WINDOW_MS           : Cửa sổ thời gian cho rate limiting
 * - CEREBRAS_EVENTS     : Các event name dùng trong proxy handler
 * - USER_AGENT          : User-Agent string dùng chung
 * ------------------------------------------------------------------
 */

export const BASE_URL = 'https://cloud.cerebras.ai';
export const API_BASE_URL = 'https://api.cerebras.ai';

export const RATE_LIMITS = {
  requests: {
    perMinute: 5,
    perHour: 150,
    perDay: 2400,
  },
  tokens: {
    perMinute: 30_000,
    perHour: 1_000_000,
    perDay: 1_000_000,
  },
} as const;

export const WINDOW_MS = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
} as const;

export const CEREBRAS_EVENTS = {
  COOKIES: 'cerebras-cookies',
  USER_INFO: 'cerebras-user-info',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';