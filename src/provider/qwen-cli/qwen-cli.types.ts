/**
 * ------------------------------------------------------------------
 * Qwen CLI Types
 * ------------------------------------------------------------------
 * Type definitions cho Qwen CLI API.
 *
 * Main exports:
 * - QwenCLITokens      : Access/refresh token structure
 * - QwenCLIConfig      : OAuth config structure
 * - QwenCLIStreamChunk : Stream chunk structure
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface QwenCLITokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface QwenCLIConfig {
  clientId: string;
  deviceCodeUrl: string;
  tokenUrl: string;
  scope: string;
  codeChallengeMethod: string;
}

export interface QwenCLIStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
  }>;
}