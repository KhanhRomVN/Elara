import { z } from 'zod';

// Common types for backend

// --- Account ---
export const AccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  credential: z.string(),
  provider_id: z.string(),
});
export type Account = z.infer<typeof AccountSchema>;

// --- Message ---
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

// --- Chat Request ---
export const ChatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(MessageSchema),
  stream: z.boolean().optional(),
  conversation_id: z.string().optional(),
  conversationId: z.string().optional(),
  search: z.boolean().optional(),
  ref_file_ids: z.array(z.string()).optional(),
  thinking: z.boolean().optional(),
  temperature: z.number().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// --- Stream Response ---
export const StreamResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(
    z.object({
      delta: z.object({
        content: z.string().optional(),
        role: z.string().optional(),
        thinking: z.string().optional(),
      }),
      index: z.number(),
      finish_reason: z.string().optional(),
    }),
  ),
});
export type StreamResponse = z.infer<typeof StreamResponseSchema>;

// --- Conversation ---
export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// --- Model Performance ---
export const ModelPerformanceSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  provider_id: z.string(),
  avg_response_time: z.number(), // in milliseconds
});
export type ModelPerformance = z.infer<typeof ModelPerformanceSchema>;

// --- API Error ---
export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

// --- Provider Types ---
import { Router } from 'express';

export interface SendMessageOptions {
  credential: string;
  provider_id: string;
  accountId?: string;
  model: string;
  messages: Message[];
  conversationId?: string;
  search?: boolean;
  ref_file_ids?: string[];
  thinking?: boolean;
  stream?: boolean;
  temperature?: number;
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: any) => void;
  onDone: () => void;
  onError: (err: any) => void;
  onRaw?: (data: string) => void;
  onSessionCreated?: (sessionId: string) => void;
}

export interface Provider {
  name: string;
  handleMessage(options: SendMessageOptions): Promise<void>;
  registerRoutes?(router: Router): void;
  getConversations?(credential: string, limit?: number): Promise<any[]>;
  getConversationDetail?(
    credential: string,
    conversationId: string,
  ): Promise<any>;
  uploadFile?(credential: string, file: any): Promise<any>;
  getModels?(credential: string, accountId?: string): Promise<any[]>;
  isModelSupported?(model: string): boolean;
  defaultModel?: string;
}
