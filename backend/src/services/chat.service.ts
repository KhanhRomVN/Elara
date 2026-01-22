import https from 'https';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { isProviderEnabled } from './provider.service';
import { createLogger } from '../utils/logger';
import { providerRegistry } from '../provider/registry';
import type { SendMessageOptions } from '../provider/types';

const logger = createLogger('ChatService');

interface ConversationOptions {
  credential: string;
  provider_id: string;
  limit?: number;
  page?: number;
}

interface ConversationDetailOptions {
  credential: string;
  provider_id: string;
  conversationId: string;
}

export type { SendMessageOptions };

// Helper function to make HTTPS requests
const makeHttpsRequest = (
  url: string,
  options: https.RequestOptions,
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(
            new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`),
          );
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

// Main service functions

export const getConversations = async (
  options: ConversationOptions,
): Promise<any[]> => {
  const { credential, provider_id, limit = 30, page = 1 } = options;

  if (!(await isProviderEnabled(provider_id))) {
    throw new Error(`Provider ${provider_id} is disabled`);
  }

  // Try dynamic registry first
  const provider = providerRegistry.getProvider(provider_id);
  if (provider && provider.getConversations) {
    return await provider.getConversations(credential, limit);
  }

  // Fallback to legacy switch if not in registry (for other providers yet to be migrated)
  switch (provider_id.toLowerCase()) {
    case 'qwen':
      return await getQwenConversations(credential, page);
    case 'huggingchat':
      return await getHuggingChatConversations(
        credential,
        Math.max(1, page) - 1,
      );
    case 'mistral':
      return (await getMistralConversations(credential)).slice(0, limit);
    case 'lmarena':
      return await getLMArenaConversations(credential, limit);
    default:
      throw new Error(`Provider ${provider_id} not supported for chat history`);
  }
};

export const sendMessage = async (
  options: SendMessageOptions,
): Promise<void> => {
  const { provider_id } = options;

  if (!(await isProviderEnabled(provider_id))) {
    throw new Error(`Provider ${provider_id} is disabled`);
  }

  // Try dynamic registry first
  const provider = providerRegistry.getProvider(provider_id);
  if (provider) {
    return await provider.handleMessage(options);
  }

  switch (provider_id.toLowerCase()) {
    case 'qwen':
      return await sendMessageQwen(options);
    case 'huggingchat':
      return await sendMessageHuggingChat(options);
    case 'mistral':
      return await sendMessageMistral(options);
    case 'lmarena':
      throw new Error('LMArena send message not implemented yet');
    default:
      throw new Error(
        `Provider ${provider_id} not supported for sending messages`,
      );
  }
};

export const getConversationDetail = async (
  options: ConversationDetailOptions,
): Promise<any> => {
  const { credential, provider_id, conversationId } = options;

  if (!(await isProviderEnabled(provider_id))) {
    throw new Error(`Provider ${provider_id} is disabled`);
  }

  const provider = providerRegistry.getProvider(provider_id);
  if (provider && provider.getConversationDetail) {
    return await provider.getConversationDetail(credential, conversationId);
  }

  switch (provider_id.toLowerCase()) {
    case 'qwen':
      return { message: 'Detail not implemented for Qwen' };
    case 'huggingchat':
      return await getHuggingChatConversationDetail(credential, conversationId);
    case 'mistral':
      return { message: 'Detail not implemented for Mistral' };
    case 'lmarena':
      return { message: 'Detail not implemented for LMArena' };
    default:
      throw new Error(`Provider ${provider_id} not supported for chat history`);
  }
};

// Helper to create Qwen chat
const createQwenChat = async (credential: string): Promise<string> => {
  const tokenMatch = credential.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  const payload = {
    title: 'New Chat',
    models: ['qwen3-max-2025-09-23'],
    chat_mode: 'normal',
    chat_type: 't2t',
    timestamp: Date.now(),
    project_id: '',
  };

  const response = await fetch('https://chat.qwen.ai/api/v2/chats/new', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Cookie: credential,
      Authorization: token ? `Bearer ${token}` : '',
      Origin: 'https://chat.qwen.ai',
      Referer: 'https://chat.qwen.ai/c/new-chat',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create Qwen chat: ${response.status} ${response.statusText}`,
    );
  }

  const data: any = await response.json();
  if (data?.data?.id) {
    return data.data.id;
  }
  throw new Error('Failed to create Qwen chat: No ID returned');
};

// Qwen-specific functions
export const sendMessageQwen = async (
  options: SendMessageOptions,
): Promise<void> => {
  const { credential, messages, onContent, onMetadata, onDone, onError } =
    options;
  let { conversationId } = options;

  try {
    // 1. Create chat if needed
    if (!conversationId) {
      conversationId = await createQwenChat(credential);
      if (onMetadata) {
        onMetadata({
          conversation_id: conversationId,
          conversation_title: 'New Chat',
        });
      }
    }

    const tokenMatch = credential.match(/token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    // Transform messages
    const qwenMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
      models: ['qwen3-max-2025-09-23'], // Default model for now, should use options.model but Qwen is specific
      chat_type: 't2t',
      feature_config: {
        thinking_enabled: false,
        output_schema: 'phase',
        research_mode: 'normal',
      },
      extra: { meta: { subChatType: 't2t' } },
      sub_chat_type: 't2t',
      parent_id: null,
      files: [],
    }));

    const payload = {
      stream: true,
      version: '2.1',
      incremental_output: true,
      chat_id: conversationId,
      chat_mode: 'normal',
      model: 'qwen3-max-2025-09-23',
      parent_id: null,
      messages: qwenMessages,
      timestamp: Date.now(),
    };

    const response = await fetch(
      `https://chat.qwen.ai/api/v2/chat/completions?chat_id=${conversationId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://chat.qwen.ai',
          Referer: `https://chat.qwen.ai/c/${conversationId}`,
          'x-accel-buffering': 'no',
          Cookie: credential,
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen API Error ${response.status}: ${errorText}`);
    }

    // Stream handling
    if (response.body) {
      // node-fetch v2 returns NodeJS.ReadableStream which is an async iterable in Node 10+?
      // We use 'data' event for compatibility.
      response.body.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const json = JSON.parse(jsonStr);
              if (json.choices && json.choices.length > 0) {
                const delta = json.choices[0].delta;
                if (delta && delta.content) {
                  onContent(delta.content);
                }
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      });

      response.body.on('end', () => {
        onDone();
      });

      response.body.on('error', (err) => {
        onError(err);
      });
    } else {
      throw new Error('No response body for stream');
    }
  } catch (error) {
    logger.error('Error sending Qwen message', error);
    onError(error);
  }
};

export const getQwenConversations = async (
  credential: string,
  page: number = 1,
): Promise<any[]> => {
  try {
    const tokenMatch = credential.match(/token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    const chats = await makeHttpsRequest(
      `https://chat.qwen.ai/api/v2/chats/?page=${page}&exclude_project=true`,
      {
        method: 'GET',
        headers: {
          Cookie: credential,
          Authorization: token ? `Bearer ${token}` : '',
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
    );

    return chats?.data || [];
  } catch (error) {
    logger.error('Error fetching Qwen conversations', error);
    throw error;
  }
};

// HuggingChat-specific functions
export const getHuggingChatConversations = async (
  credential: string,
  page: number = 0,
): Promise<any> => {
  try {
    const conversations = await makeHttpsRequest(
      `https://huggingface.co/chat/api/v2/conversations?p=${page}`,
      {
        method: 'GET',
        headers: {
          Cookie: credential,
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
    );

    return conversations;
  } catch (error) {
    logger.error('Error fetching HuggingChat conversations', error);
    throw error;
  }
};

export const getHuggingChatConversationDetail = async (
  credential: string,
  conversationId: string,
): Promise<any> => {
  try {
    const conversation = await makeHttpsRequest(
      `https://huggingface.co/chat/api/v2/conversations/${conversationId}`,
      {
        method: 'GET',
        headers: {
          Cookie: credential,
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
    );

    return conversation;
  } catch (error) {
    logger.error('Error fetching HuggingChat conversation detail', error);
    throw error;
  }
};

// Helper to create HuggingChat conversation
const createHuggingChatConversation = async (
  credential: string,
): Promise<string> => {
  const payload = {
    model: 'meta-llama/Llama-3.2-11B-Vision-Instruct', // Default model
    preprompt: '',
  };

  const response = await fetch('https://huggingface.co/chat/conversation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Cookie: credential,
      Origin: 'https://huggingface.co',
      Referer: 'https://huggingface.co/chat/',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create HuggingChat conversation: ${response.status}`,
    );
  }

  const data: any = await response.json();
  if (data?.conversationId) {
    return data.conversationId;
  }
  throw new Error('Failed to create HuggingChat conversation: No ID returned');
};

export const sendMessageHuggingChat = async (
  options: SendMessageOptions,
): Promise<void> => {
  const { credential, messages, onContent, onMetadata, onDone, onError } =
    options;
  let { conversationId } = options;

  try {
    // 1. Create conversation if needed
    if (!conversationId) {
      conversationId = await createHuggingChatConversation(credential);
      if (onMetadata) {
        onMetadata({
          conversation_id: conversationId,
          conversation_title: 'New Chat',
        });
      }
    }

    // 2. Fetch conversation details to get parentMessageId
    // We can reuse getHuggingChatConversationDetail but it returns specific format.
    // Let's call it and parse.
    const details = await getHuggingChatConversationDetail(
      credential,
      conversationId!,
    );
    let parentMessageId = '';

    if (details.messages && details.messages.length > 0) {
      // Last message
      parentMessageId = details.messages[details.messages.length - 1].id;
    } else if (details.rootMessageId) {
      parentMessageId = details.rootMessageId;
    } else {
      // Fallback random UUID
      parentMessageId = crypto.randomUUID();
    }

    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content;

    // 3. Build Multipart Body
    const boundary =
      '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    const payload = {
      inputs: content,
      id: parentMessageId,
      is_retry: false,
      is_continue: false,
      selectedMcpServerNames: [],
      selectedMcpServers: [],
    };

    let formData = '';
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="data"\r\n\r\n`;
    formData += JSON.stringify(payload) + '\r\n';
    formData += `--${boundary}--\r\n`;

    // 4. Send Request
    const response = await fetch(
      `https://huggingface.co/chat/conversation/${conversationId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Cookie: credential,
          Origin: 'https://huggingface.co',
          Referer: `https://huggingface.co/chat/conversation/${conversationId}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(`HuggingChat API Error ${response.status}`);
    }

    // 5. Stream Handling
    if (response.body) {
      response.body.on('data', (chunk: Buffer) => {
        const rawData = chunk.toString();
        // Remove null bytes
        const cleanedData = rawData.replace(/\\u0000/g, '');
        const lines = cleanedData.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            // Standard delta format mapping
            // HuggingChat sends: { type: 'stream', token: '...' }
            if (parsed.type === 'stream' && parsed.token) {
              onContent(parsed.token);
            } else if (parsed.type === 'finalAnswer') {
              // Done
            }
          } catch (e) {
            // ignore
          }
        }
      });

      response.body.on('end', () => {
        // After first message, we could fetch title if we want, but user requirement is "if available".
        // HuggingChat usually generates title via 'summarize' endpoint separately.
        // We can skip that for now or do it here.
        // Let's trigger title gen if it was new chat?
        // The prompt says "get titleConversation (if any)".
        // HuggingChat doesn't return title in stream.
        onDone();
      });

      response.body.on('error', (err) => onError(err));
    } else {
      throw new Error('No response body');
    }
  } catch (error) {
    logger.error('Error sending HuggingChat message', error);
    onError(error);
  }
};

// Helper to create Mistral chat (TRPC)
const createMistralChat = async (
  credential: string,
  content: string,
): Promise<string> => {
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

  const response = await fetch(
    'https://chat.mistral.ai/api/trpc/message.newChat?batch=1',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Cookie: credential,
        Origin: 'https://chat.mistral.ai',
        Referer: 'https://chat.mistral.ai/chat',
        'x-trpc-source': 'nextjs-react',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to create Mistral chat: ${response.status}`);
  }

  // Response is newline delimited JSONs
  const text = await response.text();
  const lines = text.split('\n').filter((line) => line.trim() !== '');

  for (const line of lines) {
    // Regex search for chatId in complex JSON
    const match = line.match(/"chatId":"([a-f0-9-]+)"/);
    if (match) {
      return match[1];
    }
  }

  throw new Error('Failed to create Mistral chat: No chatId found');
};

const streamMistral = async (
  credential: string,
  chatId: string,
  mode: 'start' | 'append',
  content: string | null, // Content only if append
  onContent: (c: string) => void,
  onDone: () => void,
  onError: (e: any) => void,
) => {
  const payload: any = {
    chatId: chatId,
    mode: mode,
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

  if (mode === 'append' && content) {
    payload.messageInput = [{ type: 'text', text: content }];
    payload.messageFiles = [];
    payload.messageId = crypto.randomUUID(); // Note: crypto needed
    payload.features = [
      'beta-code-interpreter',
      'beta-imagegen',
      'beta-websearch',
      'beta-reasoning',
    ];
    payload.libraries = [];
    payload.integrations = [];
  }

  const response = await fetch('https://chat.mistral.ai/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Cookie: credential,
      Origin: 'https://chat.mistral.ai',
      Referer: `https://chat.mistral.ai/chat/${chatId}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Mistral Stream Error ${response.status}`);
  }

  if (response.body) {
    response.body.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        // Format: 15:{"json":...}
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        try {
          const jsonStr = line.slice(colonIndex + 1);
          const data = JSON.parse(jsonStr);

          if (data?.json?.patches) {
            for (const patch of data.json.patches) {
              if (
                patch.op === 'append' &&
                patch.path.includes('/text') &&
                patch.value
              ) {
                onContent(patch.value);
              } else if (
                patch.op === 'add' &&
                patch.path.includes('/text') &&
                patch.value
              ) {
                onContent(patch.value);
              } else if (
                patch.value &&
                typeof patch.value === 'string' &&
                patch.path.endsWith('/text')
              ) {
                onContent(patch.value);
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }
    });

    response.body.on('end', () => onDone());
    response.body.on('error', onError);
  } else {
    onDone();
  }
};

export const sendMessageMistral = async (
  options: SendMessageOptions,
): Promise<void> => {
  const { credential, messages, onContent, onMetadata, onDone, onError } =
    options;
  const { conversationId } = options;

  try {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content;

    // 1. Create chat if needed
    if (!conversationId) {
      await streamMistral(
        credential,
        conversationId!,
        'start',
        null,
        onContent,
        onDone,
        onError,
      );
    } else {
      // Appending
      await streamMistral(
        credential,
        conversationId!,
        'append',
        content,
        onContent,
        onDone,
        onError,
      );
    }
  } catch (error) {
    logger.error('Error sending Mistral message', error);
    onError(error);
  }
};

export const getMistralConversations = async (
  credential: string,
): Promise<any[]> => {
  try {
    const html = await makeHttpsRequest('https://chat.mistral.ai/chat', {
      method: 'GET',
      headers: {
        Cookie: credential,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    // Parse HTML to extract conversations
    const conversations: any[] = [];
    const regex =
      /href=\\?\"\/chat\/([a-f0-9-]{36})\\?\".*?leading-5\.5[^>]*>([^<]+)<\/div>/g;
    let match;
    const seenIds = new Set<string>();

    while ((match = regex.exec(html)) !== null) {
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

    return conversations;
  } catch (error) {
    logger.error('Error fetching Mistral conversations', error);
    throw error;
  }
};

// LMArena-specific functions
export const getLMArenaConversations = async (
  credential: string,
  limit: number = 50,
): Promise<any[]> => {
  try {
    const response = await makeHttpsRequest(
      `https://lmarena.ai/api/history/list?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          Cookie: credential,
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
    );

    return response?.history || [];
  } catch (error) {
    logger.error('Error fetching LMArena conversations', error);
    throw error;
  }
};
