import { HttpClient } from '../../utils/http-client';
import { randomUUID } from 'crypto';

// Login is handled in main process, not backend

export async function sendMessage(
  token: string,
  model: string,
  messages: any[],
  onContent: (content: string) => void,
) {
  const client = new HttpClient({
    baseURL: 'https://qianwen.aliyun.com',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Origin: 'https://qianwen.aliyun.com',
      Referer: 'https://qianwen.aliyun.com/',
    },
  });

  try {
    const payload = {
      model: model || 'qwen-max',
      messages,
      stream: true,
    };

    const response = await client.post('/api/chat/completions', payload);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Qwen] API Error:', response.status, errorText);
      throw new Error(`Qwen API returned ${response.status}`);
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
    console.error('[Qwen] Send message error:', error);
    throw error;
  }
}

export async function getProfile(cookies: string) {
  const client = new HttpClient({
    baseURL: 'https://chat.qwen.ai',
    headers: {
      Cookie: cookies,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  try {
    const response = await client.get('/api/v1/auths/');
    if (response.ok) {
      const json = (await response.json()) as any;
      if (json.data) {
        return { email: json.data.email || '' };
      }
    }
  } catch (error) {
    console.error('[Qwen] getProfile Error:', error);
  }
  return null;
}

// Helper to create a new chat
async function createChat(cookies: string, headers?: Record<string, string>): Promise<string> {
  const tokenMatch = cookies.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  const client = new HttpClient({
    baseURL: 'https://chat.qwen.ai',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        headers?.['User-Agent'] ||
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      Origin: 'https://chat.qwen.ai',
      Referer: 'https://chat.qwen.ai/c/new-chat',
      'x-request-id': randomUUID(),
      Cookie: cookies,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  try {
    const payload = {
      title: 'New Chat',
      models: ['qwen3-max-2025-09-23'],
      chat_mode: 'normal',
      chat_type: 't2t',
      timestamp: Date.now(),
      project_id: '',
    };

    const response = await client.post('/api/v2/chats/new', payload);

    if (response.ok) {
      const json = (await response.json()) as any;
      if (json.data && json.data.id) {
        return json.data.id;
      }
    }
    throw new Error('Failed to create chat: No ID in response');
  } catch (error) {
    throw error;
  }
}

// Get chat history
export async function getChats(cookies: string, headers?: Record<string, string>): Promise<any[]> {
  const tokenMatch = cookies.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  const client = new HttpClient({
    baseURL: 'https://chat.qwen.ai',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        headers?.['User-Agent'] ||
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      Origin: 'https://chat.qwen.ai',
      Referer: 'https://chat.qwen.ai/',
      'x-request-id': randomUUID(),
      Cookie: cookies,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  try {
    const response = await client.get('/api/v2/chats/?page=1&exclude_project=true');
    if (response.ok) {
      const json = (await response.json()) as any;
      return Array.isArray(json.data) ? json.data : [];
    }
    return [];
  } catch (error) {
    console.error('[Qwen] getChats Error:', error);
    return [];
  }
}
