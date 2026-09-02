/**
 * ------------------------------------------------------------------
 * HuggingChat Types
 * ------------------------------------------------------------------
 * Type definitions cho HuggingChat API.
 *
 * Main exports:
 * - HuggingChatConversation : Conversation structure
 * - HuggingChatMessage      : Message structure
 * - HuggingChatStreamToken  : Stream token structure
 * - HuggingChatModel        : Model info structure
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface HuggingChatConversation {
  conversationId?: string;
  rootMessageId?: string;
  messages?: HuggingChatMessage[];
}

export interface HuggingChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
}

export interface HuggingChatStreamToken {
  type: 'stream' | 'title' | 'finalAnswer' | 'status';
  token?: string;
  title?: string;
}

export interface HuggingChatModel {
  id: string;
  displayName?: string;
  name?: string;
  providers?: Array<{ context_length?: number }>;
}