import { HttpClient } from '../../utils/http-client';
import https from 'https';

// Login is handled in main process, not backend

// Custom HTTPS agent to force IPv4
const httpsAgent = new https.Agent({ family: 4 });

export interface Account {
  id: string;
  email: string;
  provider: string;
  credential: string;
  refreshToken?: string;
  status: string;
  userAgent?: string;
}

export async function chatCompletionStream(req: any, res: any, account: Account) {
  const { model, messages, temperature } = req.body;

  // Parse credential to get access token
  let accessToken = account.credential;
  try {
    const cred = JSON.parse(account.credential);
    if (cred.access_token) {
      accessToken = cred.access_token;
    }
  } catch {
    // credential is already a string token
  }

  const client = new HttpClient({
    baseURL: 'https://generativelanguage.googleapis.com',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        account.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  try {
    const modelName = model || 'gemini-2.0-flash-exp';

    const payload = {
      contents: messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: temperature || 0.7,
      },
    };

    const response = await client.post(
      `/v1beta/models/${modelName}:streamGenerateContent?key=${accessToken}`,
      payload,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Antigravity] API Error:', response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!response.body) {
      return res.status(500).json({ error: 'No response body' });
    }

    // Stream response
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().startsWith('[')) {
          try {
            const items = JSON.parse(line);
            for (const item of items) {
              if (item.candidates?.[0]?.content?.parts?.[0]?.text) {
                const text = item.candidates[0].content.parts[0].text;
                const formatted = {
                  choices: [{ delta: { content: text } }],
                };
                res.write(`data: ${JSON.stringify(formatted)}\n\n`);
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[Antigravity] Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
