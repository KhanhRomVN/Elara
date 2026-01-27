import { isProviderEnabled } from './provider.service';
import { createLogger } from '../utils/logger';
import { providerRegistry } from '../provider/registry';
import type { SendMessageOptions } from '../provider/types';

const logger = createLogger('ChatService');

interface ConversationOptions {
  credential: string;
  provider_id: string;
  limit?: number;
  page?: number;
}

interface ConversationDetailOptions {
  credential: string;
  provider_id: string;
  conversationId: string;
}

export type { SendMessageOptions };

// Helper function to make HTTPS requests
// Helper function to make HTTPS requests - Removed as it's no longer used

// Main service functions

export const getConversations = async (
  options: ConversationOptions,
): Promise<any[]> => {
  const { credential, provider_id, limit = 30, page = 1 } = options;

  if (!(await isProviderEnabled(provider_id))) {
    throw new Error(`Provider ${provider_id} is disabled`);
  }

  // Try dynamic registry first
  const provider = providerRegistry.getProvider(provider_id);
  if (provider && provider.getConversations) {
    return await provider.getConversations(credential, limit);
  }

  throw new Error(`Provider ${provider_id} not supported for chat history`);
};

export const sendMessage = async (
  options: SendMessageOptions,
): Promise<void> => {
  const { provider_id } = options;

  if (!(await isProviderEnabled(provider_id))) {
    throw new Error(`Provider ${provider_id} is disabled`);
  }

  // Try dynamic registry first
  const provider = providerRegistry.getProvider(provider_id);
  if (provider) {
    return await provider.handleMessage(options);
  }

  throw new Error(`Provider ${provider_id} not supported for sending messages`);
};

export const getConversationDetail = async (
  options: ConversationDetailOptions,
): Promise<any> => {
  const { credential, provider_id, conversationId } = options;

  if (!(await isProviderEnabled(provider_id))) {
    throw new Error(`Provider ${provider_id} is disabled`);
  }

  const provider = providerRegistry.getProvider(provider_id);
  if (provider && provider.getConversationDetail) {
    return await provider.getConversationDetail(credential, conversationId);
  }

  throw new Error(`Provider ${provider_id} not supported for chat history`);
};
