import { ConversationTab } from '../types';

export const createDefaultTab = (id?: string): ConversationTab => {
  return {
    id: id || crypto.randomUUID(),
    title: 'New Chat',

    // Conversation state
    messages: [],
    activeChatId: null,
    conversationTitle: '',

    // Provider & account
    selectedProvider: '',
    selectedAccount: '',

    // Model selections
    claudeModel: 'claude-sonnet-4-5-20250929',
    groqModel: 'openai/gpt-oss-120b',
    antigravityModel: 'models/gemini-3-pro-preview',
    geminiModel: 'fbb127bbb056c959',
    huggingChatModel: '',
    deepseekModel: 'deepseek-ai/DeepSeek-V3.2',

    // UI state
    input: '',
    attachments: [],
    tokenCount: 0,
    accumulatedUsage: 0,
    inputTokenCount: 0,

    // Settings
    thinkingEnabled: true,
    searchEnabled: false,
    groqSettings: {
      temperature: 1,
      maxTokens: 8192,
      reasoning: 'medium' as 'none' | 'low' | 'medium' | 'high',
      stream: true,
      jsonMode: false,
      tools: {
        browserSearch: false,
        codeInterpreter: false,
      },
      customFunctions: [],
    },
  };
};

export const getTabTitle = (tab: ConversationTab): string => {
  if (tab.conversationTitle) return tab.conversationTitle;
  if (tab.messages.length > 0) {
    // Extract first user message as title
    const firstUserMessage = tab.messages.find((m) => m.role === 'user');
    if (firstUserMessage) {
      return (
        firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
      );
    }
  }
  return tab.title || 'New Chat';
};
