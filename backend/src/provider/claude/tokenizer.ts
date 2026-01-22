export const countTokens = (text: string): number => {
  if (!text) return 0;

  // Average of 4 characters per token for English text
  // We add a slight adjustment for punctuation and whitespace
  const baseTokens = Math.ceil(text.length / 4);

  // Count words for better estimation
  const words = text.trim().split(/\s+/).length;

  // Use the higher of the two estimates (more conservative)
  return Math.max(baseTokens, Math.ceil(words * 1.3));
};

/**
 * Count total tokens across multiple messages
 * @param messages Array of messages with content
 * @returns Total token count
 */
export const countMessagesTokens = (
  messages: Array<{ content: string }>,
): number => {
  return messages.reduce((total, msg) => total + countTokens(msg.content), 0);
};
