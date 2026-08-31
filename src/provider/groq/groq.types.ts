/**
 * ------------------------------------------------------------------
 * Groq Types
 * ------------------------------------------------------------------
 * Type definitions cho Groq API.
 *
 * Main exports:
 * - GroqMessage        : Message structure
 * - GroqChatPayload    : Chat completion request payload
 * - GroqStreamDelta    : Stream delta structure
 * - GroqStreamChoice   : Stream choice structure
 * - GroqStreamChunk    : Stream chunk structure
 * - GroqModel          : Model info structure
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GroqChatPayload {
  model: string;
  messages: GroqMessage[];
  stream: boolean;
  temperature?: number;
}

export interface GroqStreamDelta {
  content?: string;
  role?: string;
}

export interface GroqStreamChoice {
  delta?: GroqStreamDelta;
  finish_reason?: string | null;
}

export interface GroqStreamChunk {
  choices?: GroqStreamChoice[];
}

export interface GroqModel {
  id: string;
  active?: boolean;
  context_window?: number;
  metadata?: {
    display_name?: string;
    model_card?: string;
  };
  features?: {
    reasoning?: boolean;
  };
}