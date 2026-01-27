import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';

const logger = createLogger('QwenProvider');

const BASE_URL = 'https://chat.qwen.ai';

export class QwenProvider implements Provider {
  name = 'Qwen';
  defaultModel = 'qwen-max-latest';

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { credential, messages, onContent, onMetadata, onDone, onError } =
      options;
    let { conversationId } = options;

    try {
      // 1. Create chat if needed
      if (!conversationId) {
        conversationId = await this.createChat(credential);
        if (onMetadata) {
          onMetadata({
            conversation_id: conversationId,
            conversation_title: 'New Chat',
          });
        }
      }

      let token: string | null = null;
      let cookieValue = credential;

      if (credential.trim().startsWith('eyJ')) {
        token = credential.trim();
        if (!credential.includes('token=')) {
          cookieValue = `token=${token}`;
        }
      } else {
        const tokenMatch = credential.match(/token=([^;]+)/);
        token = tokenMatch ? tokenMatch[1] : null;
      }

      // Transform messages
      const qwenMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
        models: [this.defaultModel], // Use default model
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
        model: this.defaultModel,
        parent_id: null,
        messages: qwenMessages,
        timestamp: Date.now(),
      };

      const response = await fetch(
        `${BASE_URL}/api/v2/chat/completions?chat_id=${conversationId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Origin: BASE_URL,
            Referer: `${BASE_URL}/c/${conversationId}`,
            'x-accel-buffering': 'no',
            Cookie: cookieValue,
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
  }

  private async createChat(credential: string): Promise<string> {
    const tokenMatch = credential.match(/token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    const payload = {
      title: 'New Chat',
      models: [this.defaultModel],
      chat_mode: 'normal',
      chat_type: 't2t',
      timestamp: Date.now(),
      project_id: '',
    };

    const response = await fetch(`${BASE_URL}/api/v2/chats/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Cookie: credential,
        Authorization: token ? `Bearer ${token}` : '',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/c/new-chat`,
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
  }

  async getModels(
    credential: string,
    accountId?: string,
  ): Promise<
    {
      id: string;
      name: string;
      is_thinking: boolean;
      context_length: number | null;
    }[]
  > {
    const tokenMatch = credential.match(/token=([^;]+)/);
    let token = tokenMatch ? tokenMatch[1] : null;

    let cookieValue = credential;

    // Check if credential is a raw JWT (starts with eyJ)
    if (credential.trim().startsWith('eyJ')) {
      token = credential.trim();
      if (!credential.includes('token=')) {
        cookieValue = `token=${token}`;
      }
    }

    const headers: any = {
      authority: 'chat.qwen.ai',
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      cookie: cookieValue,
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
      'sec-ch-ua':
        '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'x-request-id': crypto.randomUUID
        ? crypto.randomUUID()
        : 'fb129784-3e36-43fd-aa59-3ded6805d420', // Use user's ID as fallback or generate new one
    };

    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }

    logger.info(`[DEBUG] Qwen getModels Request:
      Token found: ${!!token}
      Token prefix: ${token ? token.substring(0, 10) + '...' : 'NONE'}
      Cookie Length: ${cookieValue.length}
    `);

    try {
      const response = await fetch(`${BASE_URL}/api/models`, {
        headers,
      });

      if (!response.ok) {
        logger.error(
          `Failed to fetch Qwen models: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      const json: any = await response.json();
      logger.info(`[DEBUG] Qwen API Response:
        Data is Array: ${Array.isArray(json?.data)}
        Data Length: ${json?.data?.length}
        Model IDs: ${json?.data?.map((m: any) => m.id).join(', ')}
      `);

      if (json && Array.isArray(json.data)) {
        return json.data.map((model: any) => {
          // Parse capabilities for thinking
          const isThinking = model.info?.meta?.capabilities?.thinking || false;
          // Parse context length
          const contextLength = model.info?.meta?.max_context_length;

          return {
            id: model.id,
            name: model.name,
            is_thinking: isThinking,
            context_length: contextLength,
          };
        });
      }
      return [];
    } catch (error) {
      logger.error('Error fetching models from Qwen API:', error);
      return [];
    }
  }

  registerRoutes(router: Router) {
    // If we want to expose specific routes like HuggingChat does
    // For now, the registry might just use getModels via the main interface if wired up
    // But typically the backend exposes /v1/providers/:name/models
  }

  isModelSupported(model: string): boolean {
    return model.toLowerCase().includes('qwen');
  }
}
