import { net, session } from 'electron';
import { EventEmitter } from 'events';

export interface MistralChatPayload {
  model: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  temperature?: number;
}

interface ChatResponse {
  chatId: string;
}

export async function chatCompletionStream(
  cookies: string,
  payload: MistralChatPayload,
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  try {
    const userMessage = payload.messages[payload.messages.length - 1].content;
    const response = await createChat(cookies, userMessage);

    if (!response || !response.chatId) {
      throw new Error('Failed to create chat: No chatId returned');
    }

    await streamResponse(cookies, response.chatId, callbacks);
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

    // Construct the TRPC payload based on mistral.md analysis
    // The payload structure is quite deeply nested and specific
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
          model: null, // Default model logic if null?
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
          // Parse TRPC response. It sends multiple JSON objects separated by newlines.
          // We need the one with "messages" containing "chatId".
          // Example:
          // {"json":{"0":[[0],[null,0,0]]}}
          // ...
          // {"json":[2,0,[[{"messages":{...,"chatId":"..."}}]]]}

          const lines = data.split('\n').filter((line) => line.trim() !== '');
          let chatId: string | undefined;

          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              // Deep traverse to find chatId? Or use regex for safety/speed since structure might vary
              // The reference log shows it in a deeply nested structure inside "json".

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

  const payload = {
    chatId: chatId,
    mode: 'start',
    disabledFeatures: [],
    clientPromptData: {
      currentDate: new Date().toISOString().split('T')[0],
      userTimezone: 'Asia/Saigon', // Should be dynamic ideally, but hardcoded for now or passed in
    },
    stableAnonymousIdentifier: '79zqlm', // Random string or dynamic?
    shouldAwaitStreamBackgroundTasks: true,
    shouldUseMessagePatch: true,
    shouldUsePersistentStream: true,
  };

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

        // Format: "15:{\"json\":...}"
        // We need to parse this.
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const jsonStr = line.slice(colonIndex + 1);
        try {
          const data = JSON.parse(jsonStr);
          // Check for message patches
          // {"json":{"type":"message",...,"patches":[{"op":"append","path":"/contentChunks/0/text","value":"..."}]}}

          if (data?.json?.patches) {
            for (const patch of data.json.patches) {
              if (patch.op === 'append' && patch.path.includes('/text') && patch.value) {
                callbacks.onContent(patch.value);
              }
              // Mistral sometimes replaces content chunks too?
              if (patch.op === 'replace' && patch.path.includes('/text') && patch.value) {
                // This might be a full replacement or initial set.
                // For streaming, 'append' is usually what we want for delta.
                // If 'replace' is used for the whole text, we might duplicate.
                // But usually 'replace' on /contentChunks/0/text with a single string is init.
                // Let's assume append is the main carrier of new tokens.
                if (patch.value.type === 'text') {
                  callbacks.onContent(patch.value.text);
                } else if (typeof patch.value === 'string') {
                  // callbacks.onContent(patch.value); // Use with caution
                }
              }
              // Handle "add" op? contentChunks/1
              if (
                patch.op === 'add' &&
                patch.path.includes('/contentChunks') &&
                patch.value?.text
              ) {
                callbacks.onContent(patch.value.text);
              }
            }
          }

          // Check for completion?
          if (data?.json?.generationStatus === 'success' || data?.json?.status === 'success') {
            // Done
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

// --------------------------------------------------------------------------------------
// Profile Fetching
// --------------------------------------------------------------------------------------

export async function fetchMistralProfile(
  cookies: string,
): Promise<{ email: string; name: string; avatar?: string } | null> {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: 'https://console.mistral.ai/api/users/me',
    });

    request.setHeader('Cookie', cookies);
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    request.setHeader('accept', 'application/json');

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            // JSON structure from md: { "email": "...", "name": "...", ... }
            if (json.email) {
              resolve({
                email: json.email,
                name: json.name || json.first_name || 'Mistral User',
                avatar: undefined, // Mistral console doesn't seem to return avatar URL in top level
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    request.on('error', () => resolve(null));
    request.end();
  });
}
