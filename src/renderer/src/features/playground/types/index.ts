export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  backend_uuid?: string;
  read_write_token?: string;
  thinking?: string;
  thinking_elapsed?: number;
  attachments?: Attachment[];
  hiddenText?: string;
  uiHidden?: boolean;
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
  accountId?: string; // Account ID used for upload
}

export type Provider = string;

export interface Account {
  id: string;
  provider_id: string; // Changed from Provider type to string or keep Provider? Provider is a string union.
  email: string;
  name?: string;
  picture?: string;
  status?: 'Active' | 'Rate Limit' | 'Error';
}

export interface HistoryItem {
  id: string;
  title: string;
  updated_at: number;
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
  providerModels: Record<string, string>;
  providerModelsList: Record<string, any[]>;

  // UI state
  input: string;
  attachments: PendingAttachment[];
  tokenCount: number;
  accumulatedUsage: number;
  inputTokenCount: number;

  // Settings
  thinkingEnabled: boolean;
  searchEnabled: boolean;
  temperature?: number;
  agentMode?: boolean;
  selectedWorkspacePath?: string;
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
