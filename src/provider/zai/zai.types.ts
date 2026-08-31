/**
 * ------------------------------------------------------------------
 * Z.AI Types
 * ------------------------------------------------------------------
 * Type definitions cho Z.AI API.
 *
 * Main exports:
 * - ZAIAuthData           : Authentication data
 * - SignatureResult       : Signature generation result
 * - ZAIUserAgentDetails   : Parsed user-agent details
 * - ZAIStreamData         : Stream data structure
 * - ZAIModel              : Model info structure
 * - ZAICreateChatPayload  : Create chat request payload
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface ZAIAuthData {
  token: string;
  userId: string;
  email?: string;
  cookies?: string;
  userAgent?: string;
}

export interface SignatureResult {
  signature: string;
  timestamp: string;
  requestId: string;
  queryParams: string;
}

export interface ZAIUserAgentDetails {
  osName: string;
  secChUaPlatform: string;
  secChUa: string;
}

export interface ZAIStreamData {
  data?: {
    phase?: 'thinking' | 'response';
    delta_content?: string;
    done?: boolean;
  };
}

export interface ZAIModel {
  id: string;
  name: string;
  is_thinking: boolean;
  max_context_length: number | null;
}

export interface ZAICreateChatPayload {
  chat: {
    id: string;
    title: string;
    models: string[];
    params: Record<string, any>;
    history: {
      messages: Record<string, any>;
      currentId: string;
    };
    tags: any[];
    flags: any[];
    features: any[];
    mcp_servers: any[];
    enable_thinking: boolean;
    auto_web_search: boolean;
    message_version: number;
    extra: Record<string, any>;
    timestamp: number;
    type: string;
  };
}