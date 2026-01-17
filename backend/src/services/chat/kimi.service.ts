import { HttpClient } from '../../utils/http-client';

// Login is handled in main process, not backend

export async function sendMessage(
  token: string,
  model: string,
  messages: any[],
  onContent: (content: string) => void,
) {
  const client = new HttpClient({
    baseURL: 'https://kimi.moonshot.cn',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Origin: 'https://kimi.moonshot.cn',
      Referer: 'https://kimi.moonshot.cn/',
    },
  });

  try {
    const payload = {
      model: model || 'moonshot-v1-8k',
      messages,
      stream: true,
    };

    const response = await client.post('/api/chat/completions', payload);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Kimi] API Error:', response.status, errorText);
      throw new Error(`Kimi API returned ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Process SSE stream
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const json = JSON.parse(jsonStr);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              onContent(content);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[Kimi] Send message error:', error);
    throw error;
  }
}

export async function getProfile(cookies: string) {
  // Extract token from cookies for Authorization header
  const match = cookies.match(/kimi-auth=([^;]+)/);
  const token = match ? match[1] : '';

  const client = new HttpClient({
    baseURL: 'https://www.kimi.com',
    headers: {
      Cookie: cookies,
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  try {
    const response = await client.get('/api/user');

    if (response.ok) {
      const json = (await response.json()) as any;
      const email = json.email || json.user?.email || '';
      return { email };
    }
    return null;
  } catch (error) {
    console.error('[Kimi] getProfile Error:', error);
    return null;
  }
}
