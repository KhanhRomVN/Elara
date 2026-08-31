/**
 * ------------------------------------------------------------------
 * Cerebras Cloud Types
 * ------------------------------------------------------------------
 * Type definitions và constants cho Cerebras Cloud API.
 *
 * Main exports:
 * - CerebrasMessage        : Message structure
 * - CerebrasCompletionPayload : Chat completion request payload
 * - CerebrasUserInfo       : User profile info
 * - CerebrasUsageData      : Rate limiting usage data
 * - RATE_LIMITS            : Giới hạn rate per minute/hour/day
 * - WINDOW_MS              : Cửa sổ thời gian cho rate limiting
 * - BASE_URL, API_BASE_URL : API endpoints
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface CerebrasMessage {
  role: string;
  content: string;
}

export interface CerebrasCompletionPayload {
  messages: CerebrasMessage[];
  model: string;
  stream: boolean;
  temperature?: number;
  max_completion_tokens?: number;
  top_p?: number | string;
  tools?: any[];
}

export interface CerebrasUserInfo {
  email: string | null;
  name?: string;
  id?: string;
}

export interface CerebrasUsageData {
  requests: {
    minute: { used: number; limit: number };
    hour: { used: number; limit: number };
    day: { used: number; limit: number };
  };
  tokens: {
    minute: { used: number; limit: number };
    hour: { used: number; limit: number };
    day: { used: number; limit: number };
  };
}

// ─── Constants ──────────────────────────────────────────────────────────

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

export const BASE_URL = 'https://cloud.cerebras.ai';
export const API_BASE_URL = 'https://api.cerebras.ai';