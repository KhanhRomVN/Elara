/**
 * ------------------------------------------------------------------
 * Codex CLI Types
 * ------------------------------------------------------------------
 * Type definitions cho Codex CLI API.
 *
 * Main exports:
 * - CodexCLITokens       : Access/refresh token structure
 * - CodexCLIMessagePart  : Message content part
 * - CodexCLIMessage      : Message structure
 * - CodexCLIRequestBody  : Request payload cho chat completion
 * - CodexCLIStreamChunk  : Stream chunk structure
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface CodexCLITokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface CodexCLIMessagePart {
  type: 'input_text' | 'output_text';
  text: string;
}

export interface CodexCLIMessage {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: CodexCLIMessagePart[];
}

export interface CodexCLIRequestBody {
  model: string;
  instructions: string;
  input: CodexCLIMessage[];
  store: boolean;
  stream: boolean;
  include: string[];
  reasoning: { effort: string };
  conversation_id?: string;
}

export interface CodexCLIStreamChunk {
  delta?: string;
  choices?: Array<{
    delta?: { content?: string };
  }>;
  message?: {
    content?: {
      parts?: string[];
    };
  };
}