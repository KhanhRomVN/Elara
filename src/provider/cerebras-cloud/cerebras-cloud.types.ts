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

// ─── Constants (re-export) ─────────────────────────────────────────────

export {
  RATE_LIMITS,
  WINDOW_MS,
  BASE_URL,
  API_BASE_URL,
} from './cerebras-cloud.constant';