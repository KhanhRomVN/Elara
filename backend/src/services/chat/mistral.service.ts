import { HttpClient } from '../../utils/http-client';
import crypto from 'crypto';

// Login is handled in main process, not backend

export interface MistralChatPayload {
  model: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  chatId?: string;
}

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
  const client = new HttpClient({
    baseURL: 'https://chat.mistral.ai',
    headers: {
      Cookie: cookies,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Origin: 'https://chat.mistral.ai',
      Referer: 'https://chat.mistral.ai/chat',
      'x-trpc-source': 'nextjs-react',
    },
  });

  try {
    const userMessage = payload.messages[payload.messages.length - 1].content;
    let chatId = payload.chatId;

    // Create new chat if needed
    if (!chatId) {
      const trpcPayload = {
        '0': {
          json: {
            content: [{ type: 'text', text: userMessage }],
            voiceInput: null,
            audioRecording: null,
            agentId: null,
            agentsApiAgentId: null,
            files: [],
            isSampleChatForAgentId: null,
            model: payload.model || null,
            features: [
              'beta-code-interpreter',
              'beta-imagegen',
              'beta-websearch',
              'beta-reasoning',
            ],
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

      const createResponse = await client.post('/api/trpc/message.newChat?batch=1', trpcPayload);

      if (!createResponse.ok) {
        throw new Error(`Failed to create chat: ${createResponse.status}`);
      }

      const createData = (await createResponse.json()) as any;
      chatId = createData[0]?.result?.data?.json?.chatId;

      if (!chatId) {
        throw new Error('No chatId returned from newChat');
      }

      // Notify frontend of conversation ID
      if (callbacks.onMetadata) {
        callbacks.onMetadata({ conversation_uuid: chatId });
      }
    }

    // Stream response using append endpoint
    const appendPayload = {
      '0': {
        json: {
          chatId: chatId,
          content: [{ type: 'text', text: userMessage }],
          voiceInput: null,
          audioRecording: null,
          files: [],
          model: payload.model || null,
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
            model: ['undefined'],
            canva: ['undefined'],
            action: ['undefined'],
            projectId: ['undefined'],
          },
        },
      },
    };

    const streamResponse = await client.post('/api/trpc/message.append?batch=1', appendPayload);

    if (!streamResponse.ok) {
      throw new Error(`Failed to append message: ${streamResponse.status}`);
    }

    if (!streamResponse.body) {
      throw new Error('No response body');
    }

    // Process Mistral TRPC streaming format
    let buffer = '';
    for await (const chunk of streamResponse.body) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line);

          // TRPC batch response format: [{"result": {"data": {"json": {...}}}}]
          if (Array.isArray(json) && json[0]?.result?.data?.json) {
            const data = json[0].result.data.json;

            if (data.content) {
              callbacks.onContent(data.content);
            }
          }
        } catch (e) {
          // Ignore parse errors for partial chunks
        }
      }
    }

    callbacks.onDone();
  } catch (error: any) {
    console.error('[Mistral] Chat error:', error);
    callbacks.onError(error);
  }
}
