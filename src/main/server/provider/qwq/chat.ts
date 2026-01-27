import { randomUUID } from 'crypto';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export const getModels = async (_credential?: string) => {
  console.log('[QWQ] getModels called');
  const models: any[] = [];

  try {
    // Fetch the static JS file containing model definitions
    const jsUrl = 'https://qwq32.com/_next/static/chunks/8908-9588eff3feac75ec.js';
    const response = await fetch(jsUrl, {
      headers: {
        'user-agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      console.warn(`[QWQ] Failed to fetch static JS: ${response.status}`);
      return [];
    }

    const text = await response.text();

    // Look for JSON-like objects with id and name properties
    // Pattern: {"id":"some-id","name":"Some Name"
    const regex = /\{"id":"([^"]+)","name":"([^"]+)"/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const id = match[1];
      const name = match[2];

      // Only include free models or deepseek models as seemingly intended
      if (id.includes('free') || id.includes('deepseek')) {
        models.push({
          id: id,
          name: name,
          // Default values since we can't easily parse specific attributes from regex without more complex parsing
          context_length: 32000,
          is_thinking: true,
        });
      }
    }

    console.log(`[QWQ] Extracted ${models.length} models from static JS`);
  } catch (error) {
    console.error('[QWQ] Error fetching/parsing models from JS:', error);
  }

  console.log(`[QWQ] Returning models: ${JSON.stringify(models)}`);
  return models;
};

export const isModelSupported = (model: string): boolean => {
  return model.includes(':free') || model.includes('deepseek-r1-0528');
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
