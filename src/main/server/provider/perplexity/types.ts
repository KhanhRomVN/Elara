export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexityChatMessage extends ChatMessage {}

export interface PerplexityChatPayload {
  model: string;
  messages: PerplexityChatMessage[];
  stream?: boolean;
  temperature?: number;
  frontend_uuid?: string;
  last_backend_uuid?: string;
  read_write_token?: string;
  conversation_uuid?: string;
}
