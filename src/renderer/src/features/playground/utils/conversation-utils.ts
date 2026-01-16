import { Provider } from '../types';

export const getHistoryEndpoint = (provider: Provider | string, port: number | string): string => {
  const baseUrl = `http://localhost:${port}`;
  switch (provider) {
    case 'Claude':
      return `${baseUrl}/v1/claude/conversations`;
    case 'Mistral':
      return `${baseUrl}/v1/mistral/conversations`;
    case 'Kimi':
      return `${baseUrl}/v1/kimi/conversations`;
    case 'Qwen':
      return `${baseUrl}/v1/qwen/conversations`;
    case 'Cohere':
      return `${baseUrl}/v1/cohere/conversations`;
    case 'Perplexity':
      return `${baseUrl}/v1/perplexity/conversations`;
    case 'Groq':
      return `${baseUrl}/v1/groq/conversations`;
    case 'Antigravity':
      return `${baseUrl}/v1/antigravity/conversations`;
    case 'HuggingChat':
      return `${baseUrl}/v1/huggingchat/conversations`;
    case 'LMArena':
      return `${baseUrl}/v1/lmarena/conversations`;
    case 'DeepSeek':
    default:
      return `${baseUrl}/v1/deepseek/sessions`;
  }
};

export interface FormattedConversation {
  id: string;
  title: string;
  date: string;
}

export const parseConversationList = (
  provider: Provider | string,
  data: any,
): FormattedConversation[] => {
  if (!data) return [];

  switch (provider) {
    case 'Claude':
      return Array.isArray(data)
        ? data.map((conv: any) => ({
            id: conv.uuid,
            title: conv.name || conv.summary || 'Untitled',
            date: new Date(conv.updated_at).toLocaleDateString(),
          }))
        : [];

    case 'Mistral':
      return Array.isArray(data)
        ? data.map((conv: any) => ({
            id: conv.id,
            title: conv.title || 'Untitled',
            date: new Date(conv.created_at || Date.now()).toLocaleDateString(),
          }))
        : [];

    case 'Qwen':
      return Array.isArray(data)
        ? data.map((conv: any) => ({
            id: conv.id,
            title: conv.title || 'Untitled',
            date: new Date(
              conv.updated_at ? conv.updated_at * 1000 : Date.now(),
            ).toLocaleDateString(),
          }))
        : [];

    case 'Kimi':
    case 'Cohere':
      // Currently not implemented in original code or returns empty?
      // Original code returned [] for these.
      return [];

    case 'HuggingChat':
      const list = data.json?.conversations || data.conversations || [];
      return Array.isArray(list)
        ? list.map((c: any) => ({
            id: c.conversationId || c.id || c._id,
            title: c.title || 'Untitled',
            date: new Date(c.updatedAt).toLocaleDateString(),
          }))
        : [];

    case 'LMArena':
      const arenaList = data.conversations || [];
      return Array.isArray(arenaList)
        ? arenaList.map((c: any) => ({
            id: c.conversationId || c.id,
            title: c.title || 'Conversation',
            date: new Date().toLocaleDateString(), // No date in original LMArena logic?
          }))
        : [];

    case 'DeepSeek':
    default:
      // data itself is likely the array for DeepSeek based on original code `data.map`
      return Array.isArray(data)
        ? data.map((session: any) => ({
            id: session.id,
            title: session.title || 'Untitled',
            date: new Date(session.updated_at * 1000).toLocaleDateString(),
          }))
        : [];
  }
};
