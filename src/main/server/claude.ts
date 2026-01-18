import { net } from 'electron';
import { ChatPayload } from './deepseek';
import crypto from 'crypto';
import { store } from '../store';
import { loginWithRealBrowser } from './browser-login';

export async function login(options?: { claudeMethod?: 'basic' | 'google' }) {
  console.log('[Claude] login options:', options);
  return await loginWithRealBrowser({
    providerId: 'Claude',
    loginUrl: 'https://claude.ai/login',
    partition: 'persist:claude',
    cookieEvent: 'claude-cookies',
    validate: async (data: { cookies: string; headers?: any }) => {
      // Need sessionKey
      const match = data.cookies.match(/sessionKey=([^;]+)/);
      if (match && match[1]) {
        const sessionKey = match[1];
        // Validate by fetching profile
        const profile = await getProfile(sessionKey, data.headers?.['User-Agent']);
        if (profile.email) {
          return { isValid: true, cookies: sessionKey, email: profile.email };
        }
      }
      return { isValid: false };
    },
  });
}

// ... existing code ...

// Restore getProfile from legacy
export async function getProfile(
  token: string,
  userAgent?: string,
): Promise<{ email: string | null; name?: string }> {
  try {
    const origin = BASE_URL;
    const cookie = `sessionKey=${token}`;

    const setCommonHeaders = (req: Electron.ClientRequest) => {
      req.setHeader('Cookie', cookie);
      req.setHeader('Origin', origin);
      req.setHeader('Accept', 'application/json');
      req.setHeader('anthropic-client-platform', 'web_claude_ai');
      req.setHeader('anthropic-client-version', '1.0.0');
      req.setHeader('anthropic-device-id', getDeviceId());
      req.setHeader('anthropic-anonymous-id', getAnonymousId());
      if (userAgent) req.setHeader('User-Agent', userAgent);
    };

    // Use /api/bootstrap as it contains full account info including email
    const req = net.request({ method: 'GET', url: `${BASE_URL}/api/bootstrap` });
    setCommonHeaders(req);

    return new Promise((resolve, reject) => {
      let data = '';
      req.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              if (json && json.account && json.account.email_address) {
                resolve({
                  email: json.account.email_address,
                  name: json.account.full_name || json.account.display_name,
                });
              } else {
                resolve({ email: null });
              }
            } catch (e) {
              console.error('[Claude] Error parsing bootstrap data:', e);
              reject(e);
            }
          } else {
            console.error('[Claude] Bootstrap request failed:', response.statusCode);
            resolve({ email: null });
          }
        });
      });
      req.on('error', (e) => {
        console.error('[Claude] Bootstrap request error:', e);
        reject(e);
      });
      req.end();
    });
  } catch (e) {
    console.error('[Claude] Get Profile Error:', e);
    return { email: null };
  }
}

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
    onMetadata?: (metadata: any) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  try {
    const origin = BASE_URL;
    const cookie = `sessionKey=${token}`;

    // Log incoming request
    console.log('[Claude] Chat Request:', {
      conversation_id: (payload as any).conversation_id,
      parent_message_id: (payload as any).parent_message_id,
      model: payload.model,
      messageCount: payload.messages.length,
    });

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
    const orgs = await makeRequest(`${BASE_URL}/api/organizations`, 'GET');
    if (!orgs || !orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid;
    console.log('[Claude] Organization ID:', orgId);

    // 2. Conversation Handling - Use existing or create new
    const convUuid = (payload as any).conversation_id || crypto.randomUUID();
    const isNewConversation = !(payload as any).conversation_id;

    console.log('[Claude] Conversation:', {
      uuid: convUuid,
      isNew: isNewConversation,
    });

    // Only create conversation if it doesn't exist
    if (isNewConversation) {
      const model = payload.model || 'claude-sonnet-4-5-20250929';
      const convBody = {
        uuid: convUuid,
        name: '',
        model,
      };

      console.log('[Claude] Creating new conversation:', convBody);
      await makeRequest(
        `${BASE_URL}/api/organizations/${orgId}/chat_conversations`,
        'POST',
        convBody,
      );
    } else {
      console.log('[Claude] Reusing existing conversation:', convUuid);
    }

    // 3. Send Completion
    // Get the last user message content
    const lastUserMessage = [...payload.messages].reverse().find((m) => m.role === 'user');
    const prompt = lastUserMessage?.content || '';

    // Use parent_message_id from payload if available
    const completionBody = {
      prompt,
      parent_message_uuid: (payload as any).parent_message_id || null,
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

    console.log('[Claude] Completion request:', {
      url: `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${convUuid}/completion`,
      parent_message_uuid: completionBody.parent_message_uuid,
      promptLength: prompt.length,
    });

    const req = net.request({
      method: 'POST',
      url: `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${convUuid}/completion`,
    });

    setCommonHeaders(req);
    req.setHeader('Referer', `${BASE_URL}/chat/${convUuid}`);
    req.setHeader('Accept', 'text/event-stream');

    req.write(JSON.stringify(completionBody));

    let conversationUuidSent = false;

    req.on('response', (response) => {
      const decoder = new TextDecoder();
      let buffer = '';

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

              // Log full response data to understand structure
              console.log('[Claude] Response data:', JSON.stringify(data, null, 2));

              // Send conversation_uuid back to frontend on first chunk
              if (!conversationUuidSent && callbacks.onMetadata) {
                callbacks.onMetadata({ conversation_uuid: convUuid });
                conversationUuidSent = true;
                console.log('[Claude] Sent conversation_uuid to frontend:', convUuid);
              }

              // Extract and send message_uuid from message_start event
              if (data.type === 'message_start' && data.message?.uuid && callbacks.onMetadata) {
                callbacks.onMetadata({ message_uuid: data.message.uuid });
                console.log('[Claude] Sent message_uuid to frontend:', data.message.uuid);
              }

              // Extract content from different response types
              if (data.completion) {
                callbacks.onContent(data.completion);
              } else if (data.delta?.text) {
                callbacks.onContent(data.delta.text);
              } else if (data.message?.content) {
                callbacks.onContent(data.message.content);
              }
            } catch (e) {
              console.error('[Claude] Failed to parse SSE line:', line);
            }
          }
        }
      });

      response.on('end', () => {
        console.log('[Claude] Stream completed for conversation:', convUuid);
        callbacks.onDone();
      });
    });

    req.on('error', (e) => {
      console.error('[Claude] Request error:', e);
      callbacks.onError(e);
    });
    req.end();
  } catch (e: any) {
    console.error('[Claude] Fatal Error:', e);
    callbacks.onError(e);
  }
}

// Get list of conversations
export async function getConversations(
  token: string,
  userAgent?: string,
  limit: number = 30,
): Promise<any[]> {
  try {
    const origin = BASE_URL;
    const cookie = `sessionKey=${token}`;

    const setCommonHeaders = (req: Electron.ClientRequest) => {
      req.setHeader('Cookie', cookie);
      req.setHeader('Origin', origin);
      req.setHeader('Accept', 'application/json');
      req.setHeader('anthropic-client-platform', 'web_claude_ai');
      req.setHeader('anthropic-client-version', '1.0.0');
      req.setHeader('anthropic-device-id', getDeviceId());
      req.setHeader('anthropic-anonymous-id', getAnonymousId());
      if (userAgent) req.setHeader('User-Agent', userAgent);
    };

    // Get organization
    const orgsReq = net.request({ method: 'GET', url: `${BASE_URL}/api/organizations` });
    setCommonHeaders(orgsReq);

    const orgs = await new Promise<any>((resolve, reject) => {
      let data = '';
      orgsReq.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      orgsReq.on('error', reject);
      orgsReq.end();
    });

    if (!orgs || !orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid;

    // Get conversations
    const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations?limit=${limit}&consistency=eventual`;
    const req = net.request({ method: 'GET', url });
    setCommonHeaders(req);

    return new Promise((resolve, reject) => {
      let data = '';
      req.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`Failed to get conversations: ${response.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  } catch (e: any) {
    console.error('[Claude] Get Conversations Error:', e);
    throw e;
  }
}

// Get conversation detail with messages
export async function getConversationDetail(
  token: string,
  conversationId: string,
  userAgent?: string,
): Promise<any> {
  try {
    const origin = BASE_URL;
    const cookie = `sessionKey=${token}`;

    const setCommonHeaders = (req: Electron.ClientRequest) => {
      req.setHeader('Cookie', cookie);
      req.setHeader('Origin', origin);
      req.setHeader('Accept', 'application/json');
      req.setHeader('anthropic-client-platform', 'web_claude_ai');
      req.setHeader('anthropic-client-version', '1.0.0');
      req.setHeader('anthropic-device-id', getDeviceId());
      req.setHeader('anthropic-anonymous-id', getAnonymousId());
      if (userAgent) req.setHeader('User-Agent', userAgent);
    };

    // Get organization
    const orgsReq = net.request({ method: 'GET', url: `${BASE_URL}/api/organizations` });
    setCommonHeaders(orgsReq);

    const orgs = await new Promise<any>((resolve, reject) => {
      let data = '';
      orgsReq.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      orgsReq.on('error', reject);
      orgsReq.end();
    });

    if (!orgs || !orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid;

    // Get conversation detail
    const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=True&rendering_mode=messages&render_all_tools=true&consistency=eventual`;
    const req = net.request({ method: 'GET', url });
    setCommonHeaders(req);

    return new Promise((resolve, reject) => {
      let data = '';
      req.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`Failed to load conversation: ${response.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  } catch (e: any) {
    console.error('[Claude] Get Conversation Detail Error:', e);
    throw e;
  }
}

// Delete a conversation
export async function deleteConversation(
  token: string,
  conversationId: string,
  userAgent?: string,
): Promise<void> {
  try {
    const origin = BASE_URL;
    const cookie = `sessionKey=${token}`;

    const setCommonHeaders = (req: Electron.ClientRequest) => {
      req.setHeader('Cookie', cookie);
      req.setHeader('Origin', origin);
      req.setHeader('Accept', 'application/json');
      req.setHeader('anthropic-client-platform', 'web_claude_ai');
      req.setHeader('anthropic-client-version', '1.0.0');
      req.setHeader('anthropic-device-id', getDeviceId());
      req.setHeader('anthropic-anonymous-id', getAnonymousId());
      if (userAgent) req.setHeader('User-Agent', userAgent);
    };

    // Get organization
    const orgsReq = net.request({ method: 'GET', url: `${BASE_URL}/api/organizations` });
    setCommonHeaders(orgsReq);

    const orgs = await new Promise<any>((resolve, reject) => {
      let data = '';
      orgsReq.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      orgsReq.on('error', reject);
      orgsReq.end();
    });

    if (!orgs || !orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid;

    // Delete conversation
    const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${conversationId}`;
    const req = net.request({ method: 'DELETE', url });
    setCommonHeaders(req);

    return new Promise((resolve, reject) => {
      req.on('response', (response) => {
        if (response.statusCode === 200 || response.statusCode === 204) {
          resolve();
        } else {
          reject(new Error(`Failed to delete conversation: ${response.statusCode}`));
        }
      });
      req.on('error', reject);
      req.end();
    });
  } catch (e: any) {
    console.error('[Claude] Delete Conversation Error:', e);
    throw e;
  }
}
// Stop Claude response
export async function stopResponse(
  token: string,
  conversationId: string,
  userAgent?: string,
): Promise<any> {
  try {
    const origin = BASE_URL;
    const cookie = `sessionKey=${token}`;

    const setCommonHeaders = (req: Electron.ClientRequest) => {
      req.setHeader('Cookie', cookie);
      req.setHeader('Origin', origin);
      req.setHeader('Accept', 'application/json');
      req.setHeader('anthropic-client-platform', 'web_claude_ai');
      req.setHeader('anthropic-client-version', '1.0.0');
      req.setHeader('anthropic-device-id', getDeviceId());
      req.setHeader('anthropic-anonymous-id', getAnonymousId());
      if (userAgent) req.setHeader('User-Agent', userAgent);
    };

    // Get organization
    const orgsReq = net.request({ method: 'GET', url: `${BASE_URL}/api/organizations` });
    setCommonHeaders(orgsReq);

    const orgs = await new Promise<any>((resolve, reject) => {
      let data = '';
      orgsReq.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      orgsReq.on('error', reject);
      orgsReq.end();
    });

    if (!orgs || !orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid;

    // Stop response
    const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${conversationId}/stop_response`;
    const request = net.request({ method: 'POST', url });
    setCommonHeaders(request);
    request.setHeader('Content-Length', '0');

    return new Promise((resolve, reject) => {
      request.on('response', (response) => {
        if (response.statusCode === 200) {
          resolve({ success: true });
        } else {
          reject(new Error(`Failed to stop response: ${response.statusCode}`));
        }
      });
      request.on('error', reject);
      request.end();
    });
  } catch (error: any) {
    console.error('[Claude] Stop Response Error:', error);
    throw error;
  }
}
