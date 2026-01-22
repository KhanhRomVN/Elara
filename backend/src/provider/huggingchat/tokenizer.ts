import { createLogger } from '../../utils/logger';

const logger = createLogger('HuggingChatTokenizer');

/**
 * Basic character-based tokenization for HuggingChat
 * (Estimate 4 characters per token as a rule of thumb for English)
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function countMessagesTokens(messages: any[]): number {
  let total = 0;
  for (const msg of messages) {
    if (msg.content) {
      total += countTokens(msg.content);
    }
  }
  return total;
}
