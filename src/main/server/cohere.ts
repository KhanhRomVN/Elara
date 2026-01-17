import { net } from 'electron';
import { loginWithRealBrowser } from './browser-login';

export async function login() {
  return await loginWithRealBrowser({
    providerId: 'Cohere',
    loginUrl: 'https://dashboard.cohere.com/welcome/login',
    partition: 'persist:cohere',
    cookieEvent: 'cohere-cookies',
    validate: async (data: { cookies: string }) => {
      // Logic: try to get token from cookies
      const match = data.cookies.match(/access_token=([^;]+)/);
      if (match && match[1]) {
        const token = match[1];
        return { isValid: true, email: 'cohere@user.com', cookies: token };
      }
      return { isValid: false };
    },
  });
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
    temperature: 0.3, // Default from log
  };

  return new Promise<void>((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: 'https://api.cohere.com/v2/chat',
      partition: 'persist:cohere',
    });

    request.setHeader('Authorization', `Bearer ${token}`);
    request.setHeader('Content-Type', 'application/json');
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    request.setHeader('Origin', 'https://dashboard.cohere.com');
    request.setHeader('Referer', 'https://dashboard.cohere.com/');

    request.write(JSON.stringify(payload));

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        response.on('data', (d) => console.error('[Cohere] API Error Body:', d.toString()));
        reject(new Error(`Cohere API returned ${response.statusCode}`));
        return;
      }

      response.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('event: content-delta')) {
            // The next line(s) should be data: {...}
            // However, streams often come in chunks.
            // We'll rely on the fact that standard SSE format usually puts event and data close together.
            // But parsing line by line:
          }

          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();
            if (jsonStr === '[DONE]') return;
            try {
              const json = JSON.parse(jsonStr);
              // Log format: {"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"..."}}}}
              if (json.type === 'content-delta' && json.delta?.message?.content?.text) {
                onProgress(json.delta.message.content.text);
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

      response.on('error', (e: any) => reject(e));
    });

    request.on('error', (e) => reject(e));
    request.end();
  });
}
