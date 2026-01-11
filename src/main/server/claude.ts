import { net } from 'electron';
import { ChatPayload } from './deepseek';
import crypto from 'crypto';

export async function chatCompletionStream(
  token: string, // sessionKey
  payload: ChatPayload,
  userAgent: string | undefined,
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  try {
    const origin = 'https://claude.ai';
    const cookie = `sessionKey=${token}`;

    const makeRequest = (url: string, method: string, body?: any) => {
      return new Promise<any>((resolve, reject) => {
        const req = net.request({ method, url, useSessionCookies: true });
        req.setHeader('Cookie', cookie);
        req.setHeader('Origin', origin);
        req.setHeader('Referer', `${origin}/chats`);
        if (userAgent) req.setHeader('User-Agent', userAgent);
        req.setHeader('Content-Type', 'application/json');

        req.on('response', (response) => {
          let data = '';
          response.on('data', (chunk) => (data += chunk.toString()));
          response.on('end', () => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
              try {
                resolve(data ? JSON.parse(data) : null);
              } catch (e) {
                resolve(data);
              }
            } else {
              reject(new Error(`Request to ${url} failed: ${response.statusCode} - ${data}`));
            }
          });
          response.on('error', reject);
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    };

    // 1. Get Organization
    const orgs = await makeRequest('https://claude.ai/api/organizations', 'GET');
    if (!orgs || !orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid;

    // 2. Create Conversation
    const convUuid = crypto.randomUUID();
    await makeRequest(`https://claude.ai/api/organizations/${orgId}/chat_conversations`, 'POST', {
      uuid: convUuid,
      name: '',
    });

    // 3. Send Completion

    // Concatenate all messages into a single prompt for context preservation
    const prompt = payload.messages
      .map((msg) => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    const model = 'claude-3-sonnet-20240229'; // Default to Sonnet or map from payload.model

    const req = net.request({
      method: 'POST',
      url: `https://claude.ai/api/organizations/${orgId}/chat_conversations/${convUuid}/completion`,
      useSessionCookies: true,
    });

    req.setHeader('Cookie', cookie);
    req.setHeader('Origin', origin);
    req.setHeader('Referer', `${origin}/chat/${convUuid}`);
    if (userAgent) req.setHeader('User-Agent', userAgent);
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('Accept', 'text/event-stream');

    const completionBody = {
      prompt,
      timezone: 'Asia/Ho_Chi_Minh', // TODO: Detect or param
      model,
      attachments: [],
      files: [],
    };

    req.write(JSON.stringify(completionBody));

    req.on('response', (response) => {
      const decoder = new TextDecoder();
      let buffer = '';

      response.on('data', (chunk) => {
        const text = decoder.decode(chunk, { stream: true });
        buffer += text;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            try {
              const data = JSON.parse(jsonStr);
              if (data.completion) {
                callbacks.onContent(data.completion);
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      });

      response.on('end', () => {
        callbacks.onDone();
      });
    });

    req.on('error', (e) => callbacks.onError(e));
    req.end();
  } catch (e: any) {
    console.error('[Claude] Fatal Error:', e);
    callbacks.onError(e);
  }
}
