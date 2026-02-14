export interface MistralChatPayload {
  model: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  temperature?: number;
  chatId?: string;
}

export interface ChatResponse {
  chatId: string;
}

export interface MistralConversation {
  id: string;
  title: string;
  created_at?: number;
  updated_at?: number;
}

export interface MistralMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
