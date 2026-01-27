import { randomUUID } from 'crypto';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export const getModels = async (_credential?: string) => {
  console.log('[QWQ] getModels called');
  const models: any[] = [];
  console.log('[QWQ] Returning models:', JSON.stringify(models));
  return models;
};

export const chatCompletionStream = async (
  _credential: string,
  payload: any,
  _userAgent: string,
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) => {
  try {
    const { messages, model } = payload;
    console.log('[QWQ] chatCompletionStream called');
    console.log('[QWQ] Model:', model);

    // Construct QWQ payload
    const qwqPayload = {
      chatSessionId: randomUUID(),
      messages: messages.map((m: any) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      model: model,
    };

    console.log('[QWQ] Sending request:', JSON.stringify(qwqPayload));

    const response = await fetch('https://qwq32.com/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': USER_AGENT,
        origin: 'https://qwq32.com',
        referer: 'https://qwq32.com/chat',
      },
      body: JSON.stringify(qwqPayload),
    });

    console.log('[QWQ] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[QWQ] API Error Body:', errorText);
      throw new Error(`QWQ API returned ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Handle streaming using async iterator (safer for Node)
    const decoder = new TextDecoder();
    console.log('[QWQ] Starting stream processing...');

    // @ts-ignore
    for await (const chunk of response.body) {
      const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
      const lines = text.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('data: ')) {
          const dataStr = trimmedLine.substring(6);
          if (dataStr === '[DONE]') {
            console.log('[QWQ] Received [DONE] signal');
            continue;
          }

          try {
            const json = JSON.parse(dataStr);
            if (json.content) {
              // console.log('[QWQ] Content chunk:', json.content.substring(0, 20) + '...');
              callbacks.onContent(json.content);
            }
          } catch (e) {
            console.warn('[QWQ] JSON parsing error for chunk:', dataStr, e);
          }
        }
      }
    }

    console.log('[QWQ] Stream processing finished');
    callbacks.onDone();
  } catch (error: any) {
    console.error('[QWQ] Unexpected Error:', error);
    callbacks.onError(error);
  }
};
