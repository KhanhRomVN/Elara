import { Provider } from '../types';
import { getApiBaseUrl } from '../../../utils/apiUrl';

// Now uses unified endpoint for all providers
export const getHistoryEndpoint = (
  provider: Provider | string,
  port: number | string,
  accountId?: string,
): string => {
  const baseUrl = getApiBaseUrl(port);

  // Use new unified endpoint if accountId is provided
  if (accountId) {
    return `${baseUrl}/v1/chat/history/${accountId}`;
  }

  // Legacy fallback (should not be used anymore)
  const providerId = provider.toLowerCase();
  return `${baseUrl}/v1/${providerId}/conversations`;
};

export const getConversationDetailEndpoint = (
  port: number | string,
  accountId: string,
  conversationId: string,
): string => {
  const baseUrl = getApiBaseUrl(port);
  return `${baseUrl}/v1/chat/history/${accountId}/${conversationId}`;
};

export interface FormattedConversation {
  id: string;
  title: string;
  updated_at: number;
}

export const parseConversationList = (data: any): FormattedConversation[] => {
  if (!data) return [];

  // If data is already an array and contains the new structure (id, title, updated_at)
  // or it's from the unified endpoint which we just refactored on the backend.
  if (Array.isArray(data)) {
    return data.map((conv: any) => ({
      id: conv.id || conv.uuid || conv.conversationId || conv._id,
      title: conv.title || conv.name || conv.summary || 'Untitled',
      updated_at: conv.updated_at || 0,
    }));
  }

  // Fallback for non-array responses if any (HuggingChat wrappings etc.)
  const list = data.json?.conversations || data.conversations || [];
  if (Array.isArray(list)) {
    return list.map((c: any) => ({
      id: c.conversationId || c.id || c._id || c.uuid,
      title: c.title || c.name || 'Untitled',
      updated_at: c.updated_at || c.updatedAt || 0,
    }));
  }

  return [];
};
