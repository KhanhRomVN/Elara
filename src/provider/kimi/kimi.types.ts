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

// ─── Constants ──────────────────────────────────────────────────────────

export const KIMI_BASE_URL = 'https://www.kimi.ai';

export const KIMI_MODELS = {
  K3: 'k3',
  K3_SWARM: 'k3-swarm',
  INSTANT: 'instant',
  K2D6_THINKING: 'k2d6-thinking',
  K2D6: 'k2d6',
  K2D6_AGENT: 'k2d6-agent',
  K2D6_AGENT_ULTRA: 'k2d6-agent-ultra',
  KIMI_LATEST: 'kimi-latest',
} as const;

export type KimiModel = typeof KIMI_MODELS[keyof typeof KIMI_MODELS];

// ─── Types ──────────────────────────────────────────────────────────────

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