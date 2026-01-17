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

export async function chatCompletionStream(req: any, res: any, account: Account) {
  const { model, messages, temperature } = req.body;

  const client = new HttpClient({
    baseURL: 'https://api.groq.com',
    headers: {
      Authorization: `Bearer ${account.credential}`,
      'Content-Type': 'application/json',
      'User-Agent':
        account.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  try {
    const payload = {
      model: model || 'llama-3.3-70b-versatile',
      messages,
      stream: true,
      temperature: temperature || 0.7,
    };

    const response = await client.post('/openai/v1/chat/completions', payload);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Groq] API Error:', response.status, errorText);
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
        if (line.startsWith('data: ')) {
          const data = line.substring(6).trim();
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }

          try {
            const json = JSON.parse(data);
            res.write(`data: ${JSON.stringify(json)}\n\n`);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    res.end();
  } catch (error: any) {
    console.error('[Groq] Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

export async function getModels(account: Account) {
  const client = new HttpClient({
    baseURL: 'https://api.groq.com',
    headers: {
      Authorization: `Bearer ${account.credential}`,
      'User-Agent':
        account.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  try {
    const response = await client.get('/openai/v1/models');

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Groq] Get models error:', error);
    throw error;
  }
}
