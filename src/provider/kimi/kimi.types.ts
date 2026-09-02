/**
 * ------------------------------------------------------------------
 * Kimi Types
 * ------------------------------------------------------------------
 * Type definitions cho Kimi AI API.
 *
 * Main exports:
 * - KIMI_BASE_URL      : Base URL
 * - KimiCredential     : Credential structure
 * - KimiChatRequest    : Chat request payload
 * - KimiEvent          : Stream event structure
 * - KIMI_MODELS        : Model constants
 * - KimiModel          : Model type
 * ------------------------------------------------------------------
 */

// ─── Constants (re-export) ─────────────────────────────────────────────

export { KIMI_BASE_URL, KIMI_MODELS } from './kimi.constant';
export type { KimiModel } from './kimi.constant';

// ─── Types ──────────────────────────────────────────���───────────────────

export interface KimiCredential {
  token: string;
  refreshToken?: string;
  cookies?: string;
  deviceId?: string;
  sessionId?: string;
  trafficId?: string;
  userAgent?: string;
}

export interface KimiChatRequest {
  chat_id?: string;
  scenario?: 'SCENARIO_K2D5' | 'SCENARIO_OK_COMPUTER' | string;
  tools?: Array<{ type: string; search?: Record<string, any> }>;
  options?: {
    thinking?: boolean;
    enablePlugin?: boolean;
    reasoningEffort?: string;
    model?: string;
  };
  message?: {
    role: string;
    blocks: Array<{
      text?: { content: string };
      [key: string]: any;
    }>;
  };
}

export interface KimiEvent {
  op?: 'set' | 'append' | 'remove';
  mask?: string;
  eventOffset?: number;
  heartbeat?: any;
  done?: any;
  chat?: any;
  message?: any;
  block?: any;
}