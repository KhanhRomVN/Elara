/**
 * ------------------------------------------------------------------
 * Mistral Types
 * ------------------------------------------------------------------
 * Type definitions cho Mistral AI API.
 *
 * Main exports:
 * - MistralStreamPayload : Stream request payload
 * - MistralMessagePart   : Message content part
 * - MistralStreamPatch   : Stream patch structure
 * - MistralStreamData    : Stream data structure
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface MistralStreamPayload {
  chatId: string;
  mode: 'start' | 'append';
  disabledFeatures: string[];
  clientPromptData: {
    currentDate: string;
    userTimezone: string;
  };
  stableAnonymousIdentifier: string;
  shouldAwaitStreamBackgroundTasks: boolean;
  shouldUseMessagePatch: boolean;
  shouldUsePersistentStream: boolean;
  messageInput?: MistralMessagePart[];
  messageFiles?: any[];
  messageId?: string;
  features?: string[];
  libraries?: any[];
  integrations?: any[];
}

export interface MistralMessagePart {
  type: 'text';
  text: string;
}

export interface MistralStreamPatch {
  op: 'append' | 'add' | 'replace';
  path: string;
  value?: string | any;
}

export interface MistralStreamData {
  json?: {
    patches?: MistralStreamPatch[];
  };
}