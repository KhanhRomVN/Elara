/**
 * ------------------------------------------------------------------
 * Z.AI Browser Types
 * ------------------------------------------------------------------
 * Type definitions cho Z.AI Browser provider.
 *
 * Main exports:
 * - ParsedZaiCredential    : Parsed credential structure
 * - ZaiBrowserConfig       : Configuration structure
 * - ZaiBrowserSession      : Session state structure
 * - DEFAULT_ZAI_BROWSER_CONFIG : Default configuration
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import type WebSocket from 'ws';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParsedZaiCredential {
  cookie: string;
  userAgent: string;
}

export interface ZaiBrowserConfig {
  wsPort: number;
  extensionReadyTimeout: number;
  reconnectAttempts: number;
  reconnectDelayMs: number;
}

export interface ZaiBrowserSession {
  ws: WebSocket | null;
  currentRequestId: string | null;
  isConnected: boolean;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
  pendingRequests: Map<
    string,
    {
      onContent: (chunk: string) => void;
      onThinking?: (chunk: string) => void;
      onDone: () => void;
      onError: (err: Error) => void;
      onMetadata?: (meta: any) => void;
      onUsage?: (usage: any) => void;
    }
  >;
}

export const DEFAULT_ZAI_BROWSER_CONFIG: ZaiBrowserConfig = {
  wsPort: 8899,
  extensionReadyTimeout: 30000,
  reconnectAttempts: 20,
  reconnectDelayMs: 3000,
};