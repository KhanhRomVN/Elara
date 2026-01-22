export interface HuggingChatMessage {
  id?: string;
  from?: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HuggingChatConversation {
  id: string;
  title: string;
  updatedAt: string;
  model: string;
  modelId: string;
}

export interface HuggingChatConversationDetail {
  id: string;
  title: string;
  messages: HuggingChatMessage[];
  rootMessageId: string;
  modelId: string;
}

export interface HuggingChatPayload {
  inputs: string;
  id: string; // parent message id
  is_retry?: boolean;
  is_continue?: boolean;
  selectedMcpServerNames?: string[];
  selectedMcpServers?: any[];
}
