/**
 * ------------------------------------------------------------------
 * Qwen Types
 * ------------------------------------------------------------------
 * Type definitions cho Qwen AI API.
 *
 * Main exports:
 * - QwenCredential      : Credential structure
 * - QwenMessagePayload  : Message payload structure
 * - QwenFeatureConfig   : Feature config structure
 * - QwenChatPayload     : Chat request payload
 * - QwenStreamChunk     : Stream chunk structure
 * - QwenProfile         : Profile structure
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface QwenCredential {
  token: string | null;
  cookieValue: string;
  bxUa: string;
  bxUmidToken: string;
  userAgent: string;
}

export interface QwenMessagePayload {
  fid: string;
  parentId: string | null;
  childrenIds: string[];
  role: string;
  content: string;
  user_action: string;
  files: any[];
  timestamp: number;
  models: string[];
  chat_type: string;
  feature_config: QwenFeatureConfig;
  extra: { meta: { subChatType: string } };
  sub_chat_type: string;
}

export interface QwenFeatureConfig {
  thinking_enabled: boolean;
  output_schema: string;
  research_mode: string;
  auto_thinking: boolean;
  thinking_mode: string;
  auto_search: boolean;
}

export interface QwenChatPayload {
  stream: boolean;
  version: string;
  incremental_output: boolean;
  chat_id: string;
  chat_mode: string;
  model: string;
  parent_id: string | null;
  messages: QwenMessagePayload[];
  timestamp: number;
}

export interface QwenStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
  }>;
}

export interface QwenProfile {
  email: string | null;
  name?: string;
  id?: string;
}