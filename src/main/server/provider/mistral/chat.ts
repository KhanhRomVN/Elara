import { net } from 'electron';
import { MistralChatPayload, ChatResponse, MistralConversation, MistralMessage } from './types';
import { generateUUID } from './api';

export async function chatCompletionStream(
  cookies: string,
  payload: MistralChatPayload,
  callbacks: {
    onContent: (content: string) => void;
    onMetadata?: (metadata: any) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  try {
    const userMessage = payload.messages[payload.messages.length - 1].content;
    let chatId = payload.chatId;

    if (!chatId) {
      const response = await createChat(cookies, userMessage);

      if (!response || !response.chatId) {
        throw new Error('Failed to create chat: No chatId returned');
      }
      chatId = response.chatId;
    }

    // Notify frontend of the conversation ID
    if (callbacks.onMetadata) {
      callbacks.onMetadata({ conversation_uuid: chatId });
    }

    await streamResponse(cookies, chatId!, callbacks, userMessage, !!payload.chatId);
  } catch (error: any) {
    callbacks.onError(error);
  }
}

async function createChat(cookies: string, content: string): Promise<ChatResponse> {
  return new Promise((resolve, reject) => {
    // 1. Send Message (TRPC)
    const request = net.request({
      method: 'POST',
      url: 'https://chat.mistral.ai/api/trpc/message.newChat?batch=1',
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('Cookie', cookies);
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    request.setHeader('Origin', 'https://chat.mistral.ai');
    request.setHeader('Referer', 'https://chat.mistral.ai/chat');
    request.setHeader('x-trpc-source', 'nextjs-react');

    const payload = {
      '0': {
        json: {
          content: [{ type: 'text', text: content }],
          voiceInput: null,
          audioRecording: null,
          agentId: null,
          agentsApiAgentId: null,
          files: [],
          isSampleChatForAgentId: null,
          model: null,
          features: ['beta-code-interpreter', 'beta-imagegen', 'beta-websearch', 'beta-reasoning'],
          integrations: [],
          canva: null,
          action: null,
          libraries: [],
          projectId: null,
          incognito: false,
        },
        meta: {
          values: {
            voiceInput: ['undefined'],
            audioRecording: ['undefined'],
            agentId: ['undefined'],
            agentsApiAgentId: ['undefined'],
            isSampleChatForAgentId: ['undefined'],
            model: ['undefined'],
            canva: ['undefined'],
            action: ['undefined'],
            projectId: ['undefined'],
          },
        },
      },
    };

    request.write(JSON.stringify(payload));

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk.toString();
      });

      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to create chat: ${response.statusCode} - ${data}`));
          return;
        }

        try {
          const lines = data.split('\n').filter((line) => line.trim() !== '');
          let chatId: string | undefined;

          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              const str = JSON.stringify(json);
              const match = str.match(/"chatId":"([a-f0-9-]+)"/);
              if (match) {
                chatId = match[1];
                break;
              }
            } catch (e) {
              // Ignore individual line parse errors
            }
          }

          if (chatId) {
            resolve({ chatId });
          } else {
            console.error('Mistral createChat response:', data);
            reject(new Error('Could not find chatId in response'));
          }
        } catch (e: any) {
          reject(new Error(`Failed to parse createChat response: ${e.message}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });
}

async function streamResponse(
  cookies: string,
  chatId: string,
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
  newContent?: string,
  isAppendMode: boolean = false,
) {
  const request = net.request({
    method: 'POST',
    url: 'https://chat.mistral.ai/api/chat',
  });

  request.setHeader('Content-Type', 'application/json');
  request.setHeader('Cookie', cookies);
  request.setHeader(
    'User-Agent',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );
  request.setHeader('Origin', 'https://chat.mistral.ai');
  request.setHeader('Referer', `https://chat.mistral.ai/chat/${chatId}`);

  const reasoningChunks = new Set<number>();

  const payload: any = {
    chatId: chatId,
    mode: 'start',
    disabledFeatures: [],
    clientPromptData: {
      currentDate: new Date().toISOString().split('T')[0],
      userTimezone: 'Asia/Saigon',
    },
    stableAnonymousIdentifier: '79zqlm',
    shouldAwaitStreamBackgroundTasks: true,
    shouldUseMessagePatch: true,
    shouldUsePersistentStream: true,
  };

  if (isAppendMode && newContent) {
    payload.mode = 'append';
    payload.messageInput = [{ type: 'text', text: newContent }];
    payload.messageFiles = [];
    payload.messageId = generateUUID();
    payload.features = [
      'beta-code-interpreter',
      'beta-imagegen',
      'beta-websearch',
      'beta-reasoning',
    ];
    payload.libraries = [];
    payload.integrations = [];
  }

  request.write(JSON.stringify(payload));

  request.on('response', (response) => {
    if (response.statusCode && response.statusCode >= 400) {
      callbacks.onError(new Error(`Stream error: ${response.statusCode}`));
      return;
    }

    response.on('data', (chunk) => {
      const text = chunk.toString();
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const jsonStr = line.slice(colonIndex + 1);
        try {
          const data = JSON.parse(jsonStr);

          if (data?.json?.patches) {
            for (const patch of data.json.patches) {
              if (
                (patch.op === 'add' || patch.op === 'replace') &&
                patch.path.includes('/contentChunks')
              ) {
                const value = patch.value;
                if (Array.isArray(value)) {
                  value.forEach((chunk, index) => {
                    if (chunk?._context?.type === 'reasoning') {
                      reasoningChunks.add(index);
                    } else {
                      reasoningChunks.delete(index);
                    }
                  });
                } else if (value && typeof value === 'object') {
                  const pathParts = patch.path.split('/');
                  const indexStr = pathParts[pathParts.length - 1];
                  const index = parseInt(indexStr);
                  if (!isNaN(index)) {
                    if (value._context?.type === 'reasoning') {
                      reasoningChunks.add(index);
                    } else {
                      reasoningChunks.delete(index);
                    }
                  }
                }
              }

              if (patch.op === 'replace' && patch.path.includes('/_context')) {
                const match = patch.path.match(/\/contentChunks\/(\d+)\/_context/);
                if (match) {
                  const index = parseInt(match[1]);
                  if (patch.value?.type === 'reasoning') {
                    reasoningChunks.add(index);
                  } else {
                    reasoningChunks.delete(index);
                  }
                }
              }
            }

            for (const patch of data.json.patches) {
              if (patch.op === 'append' && patch.path.includes('/text') && patch.value) {
                const match = patch.path.match(/\/contentChunks\/(\d+)\/text/);
                if (match) {
                  const index = parseInt(match[1]);
                  if (!reasoningChunks.has(index)) {
                    callbacks.onContent(patch.value);
                  }
                }
              }

              if (patch.op === 'replace' && patch.path.includes('/text') && patch.value) {
                const match = patch.path.match(/\/contentChunks\/(\d+)\/text/);
                if (match) {
                  const index = parseInt(match[1]);
                  if (!reasoningChunks.has(index)) {
                    if (patch.value.type === 'text') {
                      callbacks.onContent(patch.value.text);
                    } else if (typeof patch.value === 'string') {
                      callbacks.onContent(patch.value);
                    }
                  }
                }
              }

              if (
                patch.op === 'add' &&
                patch.path.includes('/contentChunks') &&
                patch.value?.text
              ) {
                const pathParts = patch.path.split('/');
                const index = parseInt(pathParts[pathParts.length - 1]);
                if (!isNaN(index) && !reasoningChunks.has(index)) {
                  callbacks.onContent(patch.value.text);
                }
              }
            }
          }
        } catch (e) {
          // Callback error?
        }
      }
    });

    response.on('end', () => {
      callbacks.onDone();
    });

    response.on('error', (err: Error) => {
      callbacks.onError(err);
    });
  });

  request.on('error', (error) => {
    callbacks.onError(error);
  });

  request.end();
}

export async function getConversations(cookies: string): Promise<MistralConversation[]> {
  console.log('[Mistral] Fetching conversations...');
  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: 'https://chat.mistral.ai/chat',
    });

    request.setHeader('Cookie', cookies);
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    request.on('response', (response) => {
      console.log('[Mistral] Conversations response status:', response.statusCode);
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          const conversations: MistralConversation[] = [];
          const regex = /href=\\?"\/chat\/([a-f0-9-]{36})\\?".*?leading-5\.5[^>]*>([^<]+)<\/div>/g;
          let match;
          const seenIds = new Set<string>();

          while ((match = regex.exec(data)) !== null) {
            const id = match[1];
            const title = match[2];

            if (id && title && !seenIds.has(id)) {
              seenIds.add(id);
              conversations.push({
                id,
                title: title.trim(),
                created_at: Date.now(),
              });
            }
          }

          console.log(`[Mistral] Found ${conversations.length} conversations`);
          resolve(conversations);
        } else {
          console.log('[Mistral] Failed to fetch conversations, status not 200');
          resolve([]);
        }
      });
    });

    request.on('error', (e) => {
      console.error('[Mistral] Request error:', e);
      resolve([]);
    });
    request.end();
  });
}

export async function getConversationDetail(
  _cookies: string,
  _chatId: string,
): Promise<MistralMessage[]> {
  return [];
}
