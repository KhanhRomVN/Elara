import { StreamLineHandler } from './types';

export const defaultHandler: StreamLineHandler = {
  processLine: (line, currentMessageId, setMessages, onTokenUpdate, onSessionId) => {
    if (line === '[DONE]') return;

    try {
      const parsed = JSON.parse(line);
      if (parsed.error) {
        throw new Error(parsed.error);
      }

      const content = parsed.choices?.[0]?.delta?.content;
      const backend_uuid = parsed.choices?.[0]?.delta?.backend_uuid;
      const read_write_token = parsed.choices?.[0]?.delta?.read_write_token;
      const conversation_uuid = parsed.choices?.[0]?.delta?.conversation_uuid;
      const message_uuid = parsed.choices?.[0]?.delta?.message_uuid;

      if (content || backend_uuid || read_write_token || message_uuid) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentMessageId
              ? {
                  ...msg,
                  content: msg.content + (content || ''),
                  backend_uuid: backend_uuid || msg.backend_uuid,
                  read_write_token: read_write_token || msg.read_write_token,
                }
              : msg,
          ),
        );

        // Count tokens for Claude content chunks
        if (content && onTokenUpdate) {
          // Token counting moved to backend
        }
      }

      // Update conversation ID for Claude
      if (conversation_uuid && onSessionId) {
        onSessionId(conversation_uuid);
      }
    } catch (e) {
      console.error('Error parsing SSE data:', e);
    }
  },
};
