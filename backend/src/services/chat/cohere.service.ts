import { HttpClient } from '../../utils/http-client';

// Login is handled in main process, not backend

export async function getProfile(token: string) {
  const client = new HttpClient({
    baseURL: 'https://production.api.os.cohere.com',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Origin: 'https://dashboard.cohere.com',
      Referer: 'https://dashboard.cohere.com/',
    },
  });

  try {
    const response = await client.post('/rpc/BlobheartAPI/Session', {});

    if (!response.ok) {
      console.error('[Cohere] Profile error status:', response.status);
      return null;
    }

    const data = (await response.json()) as any;

    // Response format: { user: { email, name, ... } }
    if (data.user) {
      return {
        email: data.user.email || 'cohere@user.com',
      };
    }

    return null;
  } catch (error) {
    console.error('[Cohere] Profile error:', error);
    return null;
  }
}

export async function sendMessage(
  token: string,
  model: string,
  messages: any[],
  onProgress: (content: string) => void,
) {
  const payload = {
    model: model || 'command-r7b-12-2024',
    messages: messages.map((m) => ({
      role: m.role,
      content: [
        {
          type: 'text',
          text: m.content,
        },
      ],
    })),
    stream: true,
    temperature: 0.3,
  };

  const client = new HttpClient({
    baseURL: 'https://api.cohere.com',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Origin: 'https://dashboard.cohere.com',
      Referer: 'https://dashboard.cohere.com/',
    },
  });

  try {
    const response = await client.post('/v2/chat', payload);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cohere] API Error:', response.status, errorText);
      throw new Error(`Cohere API returned ${response.status}`);
    }

    // Process SSE stream
    if (!response.body) {
      throw new Error('No response body');
    }

    let buffer = '';
    for await (const chunk of response.body) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: content-delta')) {
          // Next line should be data
          continue;
        }

        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const json = JSON.parse(jsonStr);
            // Format: {"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"..."}}}}
            if (json.type === 'content-delta' && json.delta?.message?.content?.text) {
              onProgress(json.delta.message.content.text);
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[Cohere] Send message error:', error);
    throw error;
  }
}
