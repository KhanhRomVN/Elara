import { StreamLineHandler } from './types';

export const defaultHandler: StreamLineHandler = {
  processLine: (line, currentMessageId, setMessages) => {
    if (line === '[DONE]') return;

    try {
      const parsed = JSON.parse(line);
      if (parsed.error) {
        throw new Error(parsed.error);
      }

      const content = parsed.choices?.[0]?.delta?.content;
      const backend_uuid = parsed.choices?.[0]?.delta?.backend_uuid;
      const read_write_token = parsed.choices?.[0]?.delta?.read_write_token;

      if (content || backend_uuid || read_write_token) {
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
      }
    } catch (e) {
      console.error('Error parsing SSE data:', e);
    }
  },
};
