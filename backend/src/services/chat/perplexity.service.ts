import { HttpClient } from '../../utils/http-client';

// Login is handled in main process, not backend

export interface Account {
  id: string;
  email: string;
  provider: string;
  credential: string;
  status: string;
  userAgent?: string;
}

export async function chatCompletionStream(
  token: string,
  payload: {
    messages: any[];
    model: string;
    temperature?: number;
    last_backend_uuid?: string;
    read_write_token?: string;
    conversation_uuid?: string;
  },
  userAgent: string | undefined,
  callbacks: {
    onContent: (content: string) => void;
    onMetadata: (metadata: any) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  const client = new HttpClient({
    baseURL: 'https://www.perplexity.ai',
    headers: {
      Cookie: `__Secure-pplx-user-session=${token}`,
      'Content-Type': 'application/json',
      'User-Agent':
        userAgent ||
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Origin: 'https://www.perplexity.ai',
      Referer: 'https://www.perplexity.ai/',
    },
  });

  try {
    const requestPayload: any = {
      version: '2.9',
      source: 'default',
      model: payload.model || 'sonar',
      messages: payload.messages,
      temperature: payload.temperature || 0.2,
    };

    // Include context from previous messages if available
    if (payload.last_backend_uuid) {
      requestPayload.last_backend_uuid = payload.last_backend_uuid;
    }
    if (payload.read_write_token) {
      requestPayload.read_write_token = payload.read_write_token;
    }

    const response = await client.post('/socket.io/', requestPayload);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Perplexity] API Error:', response.status, errorText);
      callbacks.onError(
        new Error(`Perplexity API returned ${response.status}`),
      );
      return;
    }

    if (!response.body) {
      callbacks.onError(new Error('No response body'));
      return;
    }

    // Track metadata for conversation continuity
    let backend_uuid: string | null = null;
    let rw_token: string | null = null;
    let conv_uuid: string | null = null;

    // Process SSE stream
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();
          if (jsonStr === '[DONE]') {
            // Send final metadata
            if (backend_uuid || rw_token || conv_uuid) {
              callbacks.onMetadata({
                backend_uuid,
                read_write_token: rw_token,
                conversation_id: conv_uuid,
                conversation_title: 'New Chat',
              });
            }
            callbacks.onDone();
            return;
          }

          try {
            const json = JSON.parse(jsonStr);

            // Extract content
            if (json.output) {
              callbacks.onContent(json.output);
            }

            // Extract metadata for next request
            if (json.backend_uuid) backend_uuid = json.backend_uuid;
            if (json.read_write_token) rw_token = json.read_write_token;
            if (json.uuid) conv_uuid = json.uuid;
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    callbacks.onDone();
  } catch (error: any) {
    console.error('[Perplexity] Chat error:', error);
    callbacks.onError(error);
  }
}
