import { net } from 'electron';
import crypto from 'crypto';
import { ChatPayload } from './types';
import { BASE_URL, getDeviceId, getAnonymousId } from './api';

export async function chatCompletionStream(
  token: string, // sessionKey
  payload: ChatPayload,
  userAgent: string | undefined,
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

    // 2. Conversation Handling - Use existing or create new
    const convUuid = payload.conversation_id || crypto.randomUUID();
    const isNewConversation = !payload.conversation_id;

    // Only create conversation if it doesn't exist
    if (isNewConversation) {
      const model = payload.model || 'claude-sonnet-4-5-20250929';
      const convBody = {
        uuid: convUuid,
        name: '',
        model,
      };

      await makeRequest(
        `${BASE_URL}/api/organizations/${orgId}/chat_conversations`,
        'POST',
        convBody,
      );
    }

    // 3. Send Completion
    // Get the last user message content
    const lastUserMessage = [...payload.messages].reverse().find((m) => m.role === 'user');
    const prompt = lastUserMessage?.content || '';

    // Use parent_message_id from payload if available
    const completionBody = {
      prompt,
      parent_message_uuid: payload.parent_message_id || null,
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
      model: payload.model || 'claude-sonnet-4-5-20250929',
      tools: [
        { type: 'web_search_v0', name: 'web_search' },
        { type: 'artifacts_v0', name: 'artifacts' },
        { type: 'repl_v0', name: 'repl' },
      ],
      attachments: [],
      files: payload.ref_file_ids || [],
      sync_sources: [],
      rendering_mode: 'messages',
    };

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

              // Send conversation_uuid back to frontend on first chunk
              if (!conversationUuidSent && callbacks.onMetadata) {
                callbacks.onMetadata({ conversation_uuid: convUuid });
                conversationUuidSent = true;
              }

              // Extract and send message_uuid from message_start event
              if (data.type === 'message_start' && data.message?.uuid && callbacks.onMetadata) {
                callbacks.onMetadata({ message_uuid: data.message.uuid });
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

export async function uploadFile(
  token: string,
  fileContent: string,
  fileName: string,
  userAgent?: string,
): Promise<string> {
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

    // 1. Get Organization
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

    // 2. Upload File
    const url = `${BASE_URL}/api/${orgId}/upload`;
    const request = net.request({ method: 'POST', url });

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const crlf = '\r\n';
    const buffer = Buffer.from(fileContent.replace(/^data:.*,/, ''), 'base64');
    const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${fileName}"${crlf}Content-Type: application/octet-stream${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;
    const payloadBuffer = Buffer.concat([Buffer.from(header), buffer, Buffer.from(footer)]);

    request.setHeader('Cookie', cookie);
    request.setHeader('Origin', origin);
    request.setHeader('Referer', `${origin}/`);
    request.setHeader('Accept', 'application/json');
    request.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`);
    request.setHeader('anthropic-client-platform', 'web_claude_ai');
    request.setHeader('anthropic-client-version', '1.0.0');
    request.setHeader('anthropic-device-id', getDeviceId());
    request.setHeader('anthropic-anonymous-id', getAnonymousId());
    if (userAgent) request.setHeader('User-Agent', userAgent);
    request.setHeader('Content-Length', payloadBuffer.length.toString());

    return new Promise((resolve, reject) => {
      let data = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200 || response.statusCode === 201) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.file_uuid) {
                resolve(parsed.file_uuid);
              } else {
                reject(new Error('Upload successful but no file_uuid returned'));
              }
            } catch (e) {
              reject(e);
            }
          } else {
            console.error('[Claude] Upload failed:', data);
            reject(new Error(`Failed to upload file: ${response.statusCode}`));
          }
        });
      });
      request.on('error', reject);
      request.write(payloadBuffer);
      request.end();
    });
  } catch (error: any) {
    console.error('[Claude] Upload File Error:', error);
    throw error;
  }
}
