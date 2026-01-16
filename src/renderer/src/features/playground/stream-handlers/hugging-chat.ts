import { StreamLineHandler } from './types';

export const huggingChatHandler: StreamLineHandler = {
  processLine: (line, currentMessageId, setMessages, onTokenUpdate, onSessionId, onTitleUpdate) => {
    try {
      // Skip empty lines
      if (!line.trim()) return;

      // Parse JSONL format
      const parsed = JSON.parse(line);

      // Handle stream token updates
      if (parsed.type === 'stream') {
        const token = parsed.token || '';
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== currentMessageId) return msg;
            return {
              ...msg,
              content: (msg.content || '') + token,
            };
          }),
        );
        if (onTokenUpdate) {
          onTokenUpdate(Math.ceil((token.length || 1) / 4));
        }
      }

      // Handle final answer
      else if (parsed.type === 'finalAnswer') {
        const finalText = parsed.text || '';
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== currentMessageId) return msg;
            return {
              ...msg,
              content: finalText,
            };
          }),
        );
      }

      // Handle status/title updates
      else if (parsed.type === 'status') {
        // Status updates like "Generating..." can be ignored or shown in UI
        console.log('[HuggingChat] Status:', parsed.status);
      } else if (parsed.type === 'title' && parsed.title) {
        if (onTitleUpdate) {
          onTitleUpdate(parsed.title);
        }
      }

      // Handle conversation ID creation (for new conversations)
      else if (parsed.type === 'conversation' && parsed.id) {
        if (onSessionId) {
          onSessionId(parsed.id);
        }
      }

      // Handle tool calls (if supported in the future)
      else if (parsed.type === 'tool') {
        console.log('[HuggingChat] Tool call:', parsed);
      }

      // Handle message metadata
      else if (parsed.id && parsed.from === 'assistant') {
        // This is a message object with full metadata
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== currentMessageId) return msg;
            return {
              ...msg,
              content: parsed.content || msg.content,
              huggingchat_message_id: parsed.id,
            };
          }),
        );
      }

      // Handle updates array (incremental content updates)
      else if (parsed.updates && Array.isArray(parsed.updates)) {
        for (const update of parsed.updates) {
          if (update.type === 'stream' && update.token) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== currentMessageId) return msg;
                return {
                  ...msg,
                  content: (msg.content || '') + update.token,
                };
              }),
            );
          } else if (update.type === 'finalAnswer' && update.text) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== currentMessageId) return msg;
                return {
                  ...msg,
                  content: update.text,
                };
              }),
            );
          }
        }
      }
    } catch (e) {
      console.error('[HuggingChat] Error parsing line:', e, 'Line:', line);
    }
  },
};
