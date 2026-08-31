/**
 * ------------------------------------------------------------------
 * Claude Types
 * ------------------------------------------------------------------
 * Type definitions cho Claude AI API.
 *
 * Main exports:
 * - ClaudeAuthResponse   : Response từ auth API
 * - ClaudeMessage        : Structure của message
 * - ClaudeRequestPayload : Request payload cho chat completion
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface ClaudeAuthResponse {
  token?: string;
  cookies?: string;
  email?: string;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequestPayload {
  model: string;
  messages: ClaudeMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}