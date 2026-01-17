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
  claude_message_uuid?: string; // Message UUID from Claude API for conversation threading
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  url?: string; // For preview/display
  path?: string; // For backend processing (Electron)
  size?: number;
  mimeType?: string;
}

export interface PendingAttachment {
  id: string; // UI unique ID
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  fileId?: string; // Server returned ID
  previewUrl: string;
  progress?: number;
}

export type Provider =
  | 'Claude'
  | 'DeepSeek'
  | 'Groq'
  | 'Mistral'
  | 'Kimi'
  | 'Qwen'
  | 'Cohere'
  | 'Perplexity'
  | 'Gemini'
  | 'Antigravity'
  | 'HuggingChat'
  | 'LMArena';

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

export interface FunctionParams {
  name: string;
  description: string;
  parameters: string;
}

export interface ConversationTab {
  id: string; // Unique tab ID
  title: string; // Tab display name

  // Conversation state
  messages: Message[];
  activeChatId: string | null;
  conversationTitle: string;

  // Provider & account
  selectedProvider: string;
  selectedAccount: string;

  // Model selections
  claudeModel: string;
  groqModel: string;
  antigravityModel: string;
  geminiModel: string;
  huggingChatModel: string;
  deepseekModel: string;

  // UI state
  input: string;
  attachments: PendingAttachment[];
  tokenCount: number;
  accumulatedUsage: number;
  inputTokenCount: number;

  // Settings
  thinkingEnabled: boolean;
  searchEnabled: boolean;
  groqSettings: {
    temperature: number;
    maxTokens: number;
    reasoning: 'none' | 'low' | 'medium' | 'high';
    stream: boolean;
    jsonMode: boolean;
    tools: {
      browserSearch: boolean;
      codeInterpreter: boolean;
    };
    customFunctions: FunctionParams[];
  };
}
