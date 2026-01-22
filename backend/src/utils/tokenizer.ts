import { get_encoding, TiktokenEncoding } from 'tiktoken';
import { createLogger } from './logger';

const logger = createLogger('Tokenizer');

// Use cl100k_base as the default encoding (used by GPT-4, GPT-3.5-Turbo, and many others)
const ENCODING_NAME: TiktokenEncoding = 'cl100k_base';
let encoding: any = null;

try {
  encoding = get_encoding(ENCODING_NAME);
  logger.info(`Initialized tiktoken with ${ENCODING_NAME} encoding`);
} catch (error) {
  logger.error(`Failed to initialize tiktoken with ${ENCODING_NAME}:`, error);
}

/**
 * Counts the number of tokens in a string using tiktoken.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  if (!encoding) {
    // Fallback if tiktoken fails to initialize
    return Math.ceil(text.length / 4);
  }

  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (error) {
    logger.error('Error counting tokens with tiktoken:', error);
    return Math.ceil(text.length / 4);
  }
}

/**
 * Counts the total number of tokens in an array of messages.
 */
export function countMessagesTokens(messages: any[]): number {
  let totalTokens = 0;

  for (const message of messages) {
    if (message.content) {
      totalTokens += countTokens(message.content);
    }
    // Optional: Add constant overhead per message if needed (usually ~3-4 tokens)
    totalTokens += 4;
  }

  return totalTokens;
}

// Ensure resources are cleaned up (though in a long-running server it might not be necessary)
process.on('SIGINT', () => {
  if (encoding) {
    encoding.free();
  }
});
