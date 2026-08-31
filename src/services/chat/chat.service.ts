/**
 * ------------------------------------------------------------------
 * Chat Service (Core)
 * ------------------------------------------------------------------
 * Service core orchestration: gửi tin nhắn qua provider,
 * ghi nhận metrics, và quản lý conversation lock.
 *
 * Main functions:
 * - sendMessage() : Gửi tin nhắn qua provider và xử lý response
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Types ──
import type { SendMessageOptions } from '../../types';

// ── Providers ──
import { providerRegistry } from '../../provider/registry';
import { isProviderEnabled } from '../provider.service';

// ── Metrics ──
import { recordChatMetrics, recordError } from '../metrics.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ChatService');

// ─── State ──────────────────────────────────────────────────────────────

const pendingConversations = new Map<string, Promise<string>>();

// ─── Main Function ─────────────────────────────────────────────────────

export const sendMessage = async (
  options: SendMessageOptions,
): Promise<void> => {
  const {
    provider_id,
    messages,
    onContent,
    onDone,
    onSessionCreated,
    accountId,
  } = options;

  if (!(await isProviderEnabled(provider_id))) {
    const error = new Error(`Provider ${provider_id} is disabled`);
    recordError(
      accountId,
      provider_id,
      options.model || 'unknown',
      error.message,
    );
    throw error;
  }

  const provider = providerRegistry.getProvider(provider_id);
  if (!provider) {
    const error = new Error(
      `Provider ${provider_id} not supported for sending messages`,
    );
    recordError(
      accountId,
      provider_id,
      options.model || 'unknown',
      error.message,
    );
    throw error;
  }

  let accumulatedAssistantContent = '';

  const wrappedOptions: SendMessageOptions = {
    ...options,
    onContent: (content: string) => {
      accumulatedAssistantContent += content;
      if (onContent) onContent(content);
    },
    onSessionCreated: (sessionId: string) => {
      if (onSessionCreated) onSessionCreated(sessionId);
    },
    onDone: () => {
      if (!accumulatedAssistantContent) {
        logger.warn(
          `[sendMessage] Provider ${provider_id} completed with empty content`,
        );
      }

      recordChatMetrics(
        accountId,
        provider_id,
        options.model || 'unknown',
        messages,
        accumulatedAssistantContent,
      );

      if (onDone) onDone();
    },
  };

  try {
    return await provider.handleMessage(wrappedOptions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordError(
      accountId,
      provider_id,
      options.model || 'unknown',
      errorMessage,
    );
    throw error;
  }
};