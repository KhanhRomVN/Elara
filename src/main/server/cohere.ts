import { BrowserWindow, session, net } from 'electron';

export async function login() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      partition: 'persist:cohere',
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL('https://dashboard.cohere.com/welcome/login');
  win.show();

  return new Promise<{ cookies: string }>((resolve, reject) => {
    let manuallyClosed = false;

    const checkCookies = setInterval(async () => {
      try {
        const cookies = await session.fromPartition('persist:cohere').cookies.get({
          domain: 'dashboard.cohere.com',
        });
        const tokenCookie = cookies.find((c) => c.name === 'access_token');

        if (tokenCookie) {
          const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

          // Verify with profile fetch
          const profile = await getProfile(tokenCookie.value);
          if (profile) {
            console.log('[Cohere] Login success.');
            manuallyClosed = true;
            clearInterval(checkCookies);
            win.destroy();
            resolve({ cookies: tokenCookie.value }); // Return token value as credential
          }
        }
      } catch (error) {
        if (!manuallyClosed) {
          console.log('[Cohere] Error checking cookies:', error);
        }
      }
    }, 1000);

    win.on('closed', () => {
      clearInterval(checkCookies);
      if (manuallyClosed) return;

      console.log('[Cohere] Window closed manually. Checking for cookies...');
      session
        .fromPartition('persist:cohere')
        .cookies.get({ domain: 'dashboard.cohere.com' })
        .then(async (cookies) => {
          const tokenCookie = cookies.find((c) => c.name === 'access_token');
          if (tokenCookie) {
            const profile = await getProfile(tokenCookie.value);
            if (profile) {
              resolve({ cookies: tokenCookie.value });
              return;
            }
          }
          reject(new Error('Window closed and no valid Cohere session found.'));
        })
        .catch((err) => reject(new Error('Window closed: ' + err.message)));
    });
  });
}

export async function getProfile(token: string) {
  return new Promise<{ name: string; email: string; avatar: string } | null>((resolve) => {
    const request = net.request({
      method: 'POST',
      url: 'https://production.api.os.cohere.com/rpc/BlobheartAPI/Session',
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

    request.write('{}');

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            // Response format: { user: { email, name, ... } }
            if (json.user) {
              resolve({
                name: json.user.name || 'Cohere User',
                email: json.user.email || 'cohere@user.com',
                avatar: '', // No avatar in log response
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            console.error('[Cohere] Profile parse error:', e);
            resolve(null);
          }
        } else {
          console.error('[Cohere] Profile error status:', response.statusCode);
          resolve(null);
        }
      });
    });

    request.on('error', (e) => {
      console.error('[Cohere] Profile req error:', e);
      resolve(null);
    });
    request.end();
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

      response.on('error', (e) => reject(e));
    });

    request.on('error', (e) => reject(e));
    request.end();
  });
}
