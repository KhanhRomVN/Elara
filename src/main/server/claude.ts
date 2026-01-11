import { net } from 'electron';
import { ChatPayload } from './deepseek';
import crypto from 'crypto';
import { store } from '../store';

const BASE_URL = 'https://claude.ai';

// Generate stable device/anonymous IDs
function getDeviceId(): string {
  let deviceId = store.get('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    store.set('deviceId', deviceId);
  }
  return deviceId;
}

function getAnonymousId(): string {
  let anonId = store.get('anonymousId');
  if (!anonId) {
    anonId = `claudeai.v1.${crypto.randomUUID()}`;
    store.set('anonymousId', anonId);
  }
  return anonId;
}

export async function chatCompletionStream(
  token: string, // sessionKey - we might not need this if using session cookies, but let's keep it for now or just rely on session
  payload: ChatPayload,
  userAgent: string | undefined, // We should try to use a real browser UA if possible, or the one passed in
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  try {
    const origin = BASE_URL;
    const cookie = `sessionKey=${token}`;

    // Helper to set common headers
    const setCommonHeaders = (req: Electron.ClientRequest) => {
      req.setHeader('Cookie', cookie);
      req.setHeader('Origin', origin);
      req.setHeader('Referer', `${origin}/chats`);
      req.setHeader('Accept', 'application/json, text/event-stream');
      req.setHeader('Accept-Language', 'en-US,en;q=0.9');
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('anthropic-client-platform', 'web_claude_ai');
      req.setHeader('anthropic-client-version', '1.0.0');
      req.setHeader('anthropic-device-id', getDeviceId());
      req.setHeader('anthropic-anonymous-id', getAnonymousId());
      if (userAgent) req.setHeader('User-Agent', userAgent);
    };

    const makeRequest = (url: string, method: string, body?: any) => {
      return new Promise<any>((resolve, reject) => {
        const req = net.request({ method, url });
        setCommonHeaders(req);

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
    // We can assume if we are logged in, we have an org.
    const orgs = await makeRequest(`${BASE_URL}/api/organizations`, 'GET');
    if (!orgs || !orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid; // Use the first org

    // 2. Create Conversation
    const convUuid = crypto.randomUUID();

    // Use model from payload or default to Sonnet 4.5 (primary model)
    const model = payload.model || 'claude-sonnet-4-5-20250929';

    const convBody = {
      uuid: convUuid,
      name: '',
      model, // CRITICAL: Model must be specified when creating conversation
    };

    console.log('[Claude] Creating conversation with model:', model);
    const convResponse = await makeRequest(
      `${BASE_URL}/api/organizations/${orgId}/chat_conversations`,
      'POST',
      convBody,
    );
    console.log('[Claude] Conversation created:', JSON.stringify(convResponse, null, 2));

    // 3. Send Completion
    const prompt = payload.messages
      .map((msg) => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // Default formatting for web client (matching open-claude exactly)
    const completionBody = {
      prompt,
      parent_message_uuid: null, // CRITICAL: Must be null for first message, not convUuid
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      personalized_styles: [
        {
          type: 'default',
          key: 'Default',
          name: 'Normal',
          nameKey: 'normal_style_name',
          prompt: 'Normal',
          summary: 'Default responses from Claude',
          summaryKey: 'normal_style_summary',
          isDefault: true,
        },
      ],
      locale: 'en-US',
      tools: [
        { type: 'web_search_v0', name: 'web_search' },
        { type: 'artifacts_v0', name: 'artifacts' },
        { type: 'repl_v0', name: 'repl' },
      ],
      attachments: [],
      files: [],
      sync_sources: [],
      rendering_mode: 'messages',
    };

    console.log('[Claude] Sending completion request:');
    console.log(
      '[Claude] URL:',
      `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${convUuid}/completion`,
    );
    console.log('[Claude] Model:', model);
    console.log('[Claude] Body:', JSON.stringify(completionBody, null, 2));

    const req = net.request({
      method: 'POST',
      url: `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${convUuid}/completion`,
    });

    setCommonHeaders(req);
    // Override Referer for chat
    req.setHeader('Referer', `${BASE_URL}/chat/${convUuid}`);
    req.setHeader('Accept', 'text/event-stream');

    req.write(JSON.stringify(completionBody));

    req.on('response', (response) => {
      const decoder = new TextDecoder();
      let buffer = '';

      console.log('[Claude] Response status:', response.statusCode);

      if (response.statusCode !== 200) {
        response.on('data', (chunk) => {
          const errorText = decoder.decode(chunk);
          console.error('[Claude] Error body:', errorText);
        });
        response.on('end', () => {
          callbacks.onError(new Error(`Completion failed: ${response.statusCode}`));
        });
        return;
      }

      console.log('[Claude] Starting to stream response...');

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
              console.log('[Claude] SSE data:', JSON.stringify(data, null, 2));
              if (data.completion) {
                console.log('[Claude] Sending content (completion):', data.completion);
                callbacks.onContent(data.completion);
              } else if (data.delta?.text) {
                console.log('[Claude] Sending content (delta.text):', data.delta.text);
                callbacks.onContent(data.delta.text);
              } else if (data.message?.content) {
                console.log('[Claude] Sending content (message.content):', data.message.content);
                callbacks.onContent(data.message.content);
              }
            } catch (e) {
              console.error('[Claude] Failed to parse SSE line:', line);
            }
          }
        }
      });

      response.on('end', () => {
        console.log('[Claude] Streaming completed');
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
