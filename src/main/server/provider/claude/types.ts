export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatPayload {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  conversation_id?: string;
  parent_message_id?: string;
  ref_file_ids?: string[];
}
