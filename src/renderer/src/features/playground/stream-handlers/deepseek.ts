import { StreamLineHandler } from './types';

// Basic state to track expected next data type
let nextDataType: string | null = null;

export const deepseekHandler: StreamLineHandler = {
  processLine: (line, currentMessageId, setMessages, onTokenUpdate, onSessionId) => {
    try {
      // Handle SSE events (e.g., "event: session_created")
      if (line.startsWith('event:')) {
        const eventType = line.replace('event:', '').trim();
        if (eventType === 'session_created') {
          nextDataType = 'session_created';
        }
        return;
      }

      if (nextDataType === 'session_created') {
        if (onSessionId && line.trim()) {
          onSessionId(line.trim());
        }
        nextDataType = null;
        return;
      }

      // Standard data line handling
      if (!line.trim() || !line.trim().startsWith('{')) return;

      const parsed = JSON.parse(line);

      // Handle ready event data to capture message IDs
      if (parsed.request_message_id !== undefined && parsed.response_message_id !== undefined) {
        setMessages((prev) => {
          return prev.map((msg) => {
            if (msg.id === currentMessageId) {
              return {
                ...msg,
                deepseek_message_id: parsed.response_message_id,
              };
            }
            return msg;
          });
        });
        return;
      }

      // Handle value updates - Check if 'v' exists and is a string
      if (parsed.v !== undefined && typeof parsed.v === 'string') {
        const value = parsed.v;
        const path = parsed.p;
        const op = parsed.o;

        setMessages((prev) => {
          return prev.map((msg) => {
            if (msg.id !== currentMessageId) return msg;

            let newMsg = { ...msg };
            // let updated = false;

            // 1. Explicit Thinking Content Update (e.g., {"p":"response/thinking_content","v":"H"})
            if (path === 'response/thinking_content' || path?.endsWith('thinking_content')) {
              newMsg.thinking = (newMsg.thinking || '') + value;
              newMsg._deepseek_mode = 'THINK';
              // updated = true;
            }

            // 2. Explicit Content Update (e.g., {"p":"response/content","v":"X"})
            else if (path === 'response/content') {
              newMsg.content = (newMsg.content || '') + value;
              newMsg._deepseek_mode = 'RESPONSE';
              // updated = true;
            }

            // 3. Fragment content update (e.g., {"p":"response/fragments/-1/content","v":"..."})
            // This happens when DeepSeek streams incremental updates to the active fragment
            else if (path?.includes('fragments') && path?.endsWith('/content')) {
              const mode = newMsg._deepseek_mode || 'RESPONSE';
              if (mode === 'THINK') {
                newMsg.thinking = (newMsg.thinking || '') + value;
              } else {
                newMsg.content = (newMsg.content || '') + value;
              }
              // updated = true;
            }

            // 4. Implicit Update (Missing 'p' or just has 'o' and 'v')
            // e.g., {"o":"APPEND","v":"mm"} or {"v":","}
            else if (!path && value) {
              // Check if it's a finish event or similar non-content update
              if (op === 'BATCH' || op === 'SET') return newMsg; // Ignore batch/set status updates

              const mode = newMsg._deepseek_mode || 'RESPONSE';
              if (mode === 'THINK') {
                newMsg.thinking = (newMsg.thinking || '') + value;
              } else {
                newMsg.content = (newMsg.content || '') + value;
              }
              // updated = true;
            }

            return newMsg;
          });
        });
      }

      // Handle fragment array creation (e.g., {"p":"response/fragments","o":"APPEND","v":[{...}]})
      else if (Array.isArray(parsed.v) && parsed.p === 'response/fragments') {
        const fragment = parsed.v[0];

        setMessages((prev) => {
          return prev.map((msg) => {
            if (msg.id !== currentMessageId) return msg;

            let newMsg = { ...msg };

            if (fragment.type === 'THINK') {
              newMsg.thinking = (newMsg.thinking || '') + (fragment.content || '');
              newMsg._deepseek_mode = 'THINK';
            } else if (fragment.type === 'RESPONSE') {
              newMsg.content = (newMsg.content || '') + (fragment.content || '');
              newMsg._deepseek_mode = 'RESPONSE';
            }

            return newMsg;
          });
        });
      }

      // Handle elapsed time and other metadata updates
      else if (parsed.p?.endsWith('/elapsed_secs') || parsed.p?.endsWith('thinking_elapsed_secs')) {
        setMessages((prev) => {
          return prev.map((msg) => {
            if (msg.id !== currentMessageId) return msg;
            return { ...msg, thinking_elapsed: parsed.v };
          });
        });
      }

      // Handle Batch operations for token usage
      if (parsed.o === 'BATCH' && Array.isArray(parsed.v)) {
        const tokenUsageItem = parsed.v.find((item: any) => item.p === 'accumulated_token_usage');
        if (tokenUsageItem && typeof tokenUsageItem.v === 'number') {
          if (onTokenUpdate) {
            onTokenUpdate(tokenUsageItem.v);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing DeepSeek data:', e, 'Line:', line);
    }
  },
};
