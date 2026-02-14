import { net } from 'electron';
import { randomUUID } from 'crypto';

// Helper to create a new chat
async function createChat(cookies: string, headers?: Record<string, string>): Promise<string> {
  const tokenMatch = cookies.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: 'https://chat.qwen.ai/api/v2/chats/new',
      partition: 'persist:qwen',
    });

    const finalHeaders = {
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
    } as Record<string, any>;

    // Clean headers
    Object.keys(finalHeaders).forEach((key) => {
      if (!finalHeaders[key]) delete finalHeaders[key];
    });

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.data && json.data.id) {
              resolve(json.data.id);
            } else {
              reject(new Error('Failed to create chat: No ID in response'));
            }
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`Create chat failed: ${response.statusCode} ${data}`));
        }
      });
      response.on('error', reject);
    });

    request.on('error', reject);

    // Set headers
    Object.entries(finalHeaders).forEach(([k, v]) => request.setHeader(k, v as string));

    const payload = {
      title: 'New Chat',
      models: ['qwen3-max-2025-09-23'],
      chat_mode: 'normal',
      chat_type: 't2t',
      timestamp: Date.now(),
      project_id: '',
    };

    request.write(JSON.stringify(payload));
    request.end();
  });
}

// Get chat history
export async function getChats(cookies: string, headers?: Record<string, string>): Promise<any[]> {
  const tokenMatch = cookies.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url: 'https://chat.qwen.ai/api/v2/chats/?page=1&exclude_project=true',
      partition: 'persist:qwen',
    });

    const finalHeaders = {
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
    } as Record<string, any>;

    // Clean headers
    Object.keys(finalHeaders).forEach((key) => {
      if (!finalHeaders[key]) delete finalHeaders[key];
    });

    Object.entries(finalHeaders).forEach(([k, v]) => request.setHeader(k, v as string));

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.data && Array.isArray(json.data)) {
              resolve(json.data);
            } else {
              resolve(json.data || []);
            }
          } catch (e) {
            console.error('[Qwen] getChats Parse Error:', e);
            resolve([]);
          }
        } else {
          console.error(`[Qwen] getChats failed: ${response.statusCode} ${data}`);
          resolve([]);
        }
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.end();
  });
}

export async function sendMessage(
  cookies: string,
  _model: string,
  messages: any[],
  onProgress: (content: string) => void,
  headers?: Record<string, string>,
) {
  // 1. Create chat if needed
  let chatId: string = '';
  try {
    console.log('[Qwen] Creating new chat session...');
    chatId = await createChat(cookies, headers);
    console.log('[Qwen] New Chat ID Obtained:', chatId);
    if (!chatId) {
      throw new Error('Chat ID obtained is empty or invalid');
    }
  } catch (e) {
    console.error('[Qwen] Failed to create chat:', e);
    throw e;
  }

  const parentId = null;

  // Qwen internal API message structure
  const qwenMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
    models: ['qwen3-max-2025-09-23'],
    chat_type: 't2t',
    feature_config: {
      thinking_enabled: false,
      output_schema: 'phase',
      research_mode: 'normal',
    },
    extra: { meta: { subChatType: 't2t' } },
    sub_chat_type: 't2t',
    parent_id: null,
    files: [],
  }));

  const payload = {
    stream: true,
    version: '2.1',
    incremental_output: true,
    chat_id: chatId,
    chat_mode: 'normal',
    model: 'qwen3-max-2025-09-23',
    parent_id: parentId,
    messages: qwenMessages,
    timestamp: Date.now(),
  };

  // Extract token from cookies for Authorization header
  const tokenMatch = cookies.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  return new Promise<void>((resolve, reject) => {
    const url = `https://chat.qwen.ai/api/v2/chat/completions?chat_id=${chatId}`;

    const finalHeaders = {
      'Content-Type': 'application/json',
      'User-Agent':
        headers?.['User-Agent'] ||
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      Origin: 'https://chat.qwen.ai',
      Referer: `https://chat.qwen.ai/c/${chatId}`,
      'x-request-id': randomUUID(),
      'x-accel-buffering': 'no',
      Cookie: cookies,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    } as Record<string, any>;

    // Ensure no undefined headers
    Object.keys(finalHeaders).forEach((key) => {
      if (!finalHeaders[key]) delete finalHeaders[key];
    });

    const request = net.request({
      method: 'POST',
      url,
      partition: 'persist:qwen',
      headers: finalHeaders as Record<string, string>,
    });

    request.on('error', (error) => {
      console.error('[Qwen] Request Error:', error);
      reject(error);
    });

    request.on('response', (response) => {
      response.on('error', (err: any) => {
        console.error('[Qwen] Stream Error:', err);
        reject(err);
      });

      if (response.statusCode && response.statusCode >= 400) {
        let errorBody = '';
        response.on('data', (chunk) => {
          errorBody += chunk.toString();
        });

        response.on('end', () => {
          reject(new Error(`Qwen API returned ${response.statusCode}: ${errorBody.slice(0, 200)}`));
        });
        return;
      }

      response.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();
            if (jsonStr === '[DONE]') return;
            try {
              const json = JSON.parse(jsonStr);
              if (json.choices && json.choices.length > 0) {
                const delta = json.choices[0].delta;
                if (delta && delta.content) {
                  onProgress(delta.content);
                }
              }
            } catch (e) {
              // ignore
            }
          }
        }
      });

      response.on('end', () => {
        resolve();
      });
    });

    request.write(JSON.stringify(payload));
    request.end();
  });
}
