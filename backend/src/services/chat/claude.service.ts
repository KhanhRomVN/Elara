import { HttpClient } from '../../utils/http-client';
import crypto from 'crypto';

// Login is handled in main process, not backend

const BASE_URL = 'https://claude.ai';

export interface ChatPayload {
  model: string;
  messages: Array<{ role: string; content: string }>;
  conversation_id?: string;
  parent_message_id?: string;
  stream?: boolean;
}

// Generate device/anonymous IDs (not persisted in backend)
function getDeviceId(): string {
  return crypto.randomUUID();
}

function getAnonymousId(): string {
  return `claudeai.v1.${crypto.randomUUID()}`;
}

export async function chatCompletionStream(
  token: string,
  payload: ChatPayload,
  userAgent: string | undefined,
  callbacks: {
    onContent: (content: string) => void;
    onMetadata?: (metadata: any) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  const client = new HttpClient({
    baseURL: BASE_URL,
    headers: {
      Cookie: `sessionKey=${token}`,
      'Content-Type': 'application/json',
      'User-Agent':
        userAgent ||
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Origin: BASE_URL,
      Referer: `${BASE_URL}/chats`,
      Accept: 'application/json, text/event-stream',
      'anthropic-client-platform': 'web_claude_ai',
      'anthropic-client-version': '1.0.0',
      'anthropic-device-id': getDeviceId(),
      'anthropic-anonymous-id': getAnonymousId(),
    },
  });

  try {
    // 1. Get Organization
    const orgsResponse = await client.get('/api/organizations');
    const orgs = (await orgsResponse.json()) as any[];

    if (!orgs || !orgs.length) {
      throw new Error('No organizations found');
    }
    const orgId = orgs[0].uuid;

    // 2. Handle Conversation
    const convUuid = payload.conversation_id || crypto.randomUUID();
    const isNewConversation = !payload.conversation_id;

    if (isNewConversation) {
      // Create new conversation
      await client.post(`/api/organizations/${orgId}/chat_conversations`, {
        uuid: convUuid,
        name: '',
      });
    }

    // 3. Send Message
    const lastMessage = payload.messages[payload.messages.length - 1];
    const messagePayload = {
      prompt: lastMessage.content,
      timezone: 'UTC',
      model: payload.model || 'claude-3-5-sonnet-20241022',
      attachments: [],
    };

    console.log(
      '[Claude] Sending payload:',
      JSON.stringify(messagePayload, null, 2),
    );

    const response = await client.post(
      `/api/organizations/${orgId}/chat_conversations/${convUuid}/completion`,
      messagePayload,
    );

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError(
        new Error(`Claude API returned ${response.status}: ${errorText}`),
      );
      return;
    }

    // Send metadata
    if (callbacks.onMetadata) {
      callbacks.onMetadata({
        conversation_id: convUuid,
        conversation_title: 'New Chat', // Claude auto-generates titles, but we start with this or fetch later
      });
    }

    // Process SSE stream
    if (!response.body) {
      callbacks.onError(new Error('No response body'));
      return;
    }

    let buffer = '';
    for await (const chunk of response.body) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();
          if (jsonStr === '[DONE]') {
            callbacks.onDone();
            return;
          }

          try {
            const json = JSON.parse(jsonStr);

            // Claude SSE format: {"completion": "text", "stop_reason": null, ...}
            if (json.completion) {
              callbacks.onContent(json.completion);
            }

            if (json.stop_reason) {
              callbacks.onDone();
              return;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    callbacks.onDone();
  } catch (error: any) {
    console.error('[Claude] Chat error:', error);
    callbacks.onError(error);
  }
}
