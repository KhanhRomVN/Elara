import { StreamLineHandler } from './types';

export const lmArenaHandler: StreamLineHandler = {
  processLine: (line, currentMessageId, setMessages, onTokenUpdate, onSessionId) => {
    try {
      if (!line.trim() || line.trim() === '[DONE]') return;

      const parsed = JSON.parse(line);
      // Handle standard OpenAI format (converted by backend)
      if (parsed.choices && parsed.choices[0]?.delta?.content) {
        const content = parsed.choices[0].delta.content;
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== currentMessageId) return msg;
            return {
              ...msg,
              content: (msg.content || '') + content,
            };
          }),
        );
        if (onTokenUpdate) onTokenUpdate(1);
      }
      // Handle potential session ID if passed in metadata (custom)
      if (parsed.id) {
        // Optional: handle if backend sends session ID
      }
    } catch (e) {
      // console.error('Error parsing line:', e);
    }
  },
};
