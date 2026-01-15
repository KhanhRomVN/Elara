export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  backend_uuid?: string;
  read_write_token?: string;
  thinking?: string;
  thinking_elapsed?: number;
  _deepseek_mode?: 'THINK' | 'RESPONSE';
  deepseek_message_id?: number; // Response message ID from DeepSeek API for conversation threading
}

export type Provider =
  | 'Claude'
  | 'DeepSeek'
  | 'Groq'
  | 'ChatGPT'
  | 'Mistral'
  | 'Kimi'
  | 'Qwen'
  | 'Cohere'
  | 'Perplexity'
  | 'Gemini'
  | 'Antigravity'
  | 'Zai';

export interface Account {
  id: string;
  provider: Provider;
  email: string;
  name?: string;
  picture?: string;
  status?: 'Active' | 'Rate Limit' | 'Error';
}

export interface HistoryItem {
  id: string;
  title: string;
  // Add other fields if necessary
}
