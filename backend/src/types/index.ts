// Common types for backend
export interface Account {
  id: string;
  email: string;
  provider: string;
  status: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  thinking?: boolean;
  search?: boolean;
  ref_file_ids?: string[];
  conversation_id?: string;
  parent_message_id?: string;
  temperature?: number;
  max_completion_tokens?: number;
  reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
  response_format?: { type: string };
  tools?: any[];
}

export interface StreamResponse {
  id: string;
  model: string;
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    index: number;
    finish_reason?: string;
  }>;
}

export interface Conversation {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}
