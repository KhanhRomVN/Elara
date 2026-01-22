import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { HttpClient } from '../../utils/http-client';
import * as crypto from 'crypto';
import { findAccount } from '../../services/account-selector';
import { createLogger } from '../../utils/logger';
import { countTokens, countMessagesTokens } from '../../utils/tokenizer';

const logger = createLogger('HuggingChatProvider');

const BASE_URL = 'https://huggingface.co';

export class HuggingChatProvider implements Provider {
  name = 'HuggingChat';
  defaultModel = 'omni';

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
    } = options;

    const cookieHeader = credential; // For HuggingChat, credential is the cookie string
    const client = this.createClient(cookieHeader);

    try {
      // 1. Get/Create Conversation
      let conversationId = options.conversationId;
      if (!conversationId) {
        const createRes = await client.post('/chat/conversation', {
          model: model || this.defaultModel,
          preprompt: '',
        });
        const createData = await createRes.json();
        conversationId = createData.conversationId;
      }

      if (!conversationId) throw new Error('Failed to obtain conversation ID');

      // 2. Fetch Conversation Details to get parentMessageId
      const detailRes = await client.get(
        `/chat/api/v2/conversations/${conversationId}`,
      );
      const detail = await detailRes.json();
      const details = detail.json || detail;

      let parentMessageId = '';
      if (details.messages && details.messages.length > 0) {
        const lastMsg = details.messages[details.messages.length - 1];
        parentMessageId = lastMsg.id;
      } else if (details.rootMessageId) {
        parentMessageId = details.rootMessageId;
      } else {
        parentMessageId = crypto.randomUUID();
      }

      // 3. Send Message (Multipart Form Data)
      const lastMessage = messages[messages.length - 1];
      const boundary =
        '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');

      const payload = {
        inputs: lastMessage.content,
        id: parentMessageId,
        is_retry: false,
        is_continue: false,
        selectedMcpServerNames: [],
        selectedMcpServers: [],
      };

      const formData = `--${boundary}\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--\r\n`;
      const formBuffer = Buffer.from(formData, 'utf-8');

      const response = await fetch(
        `${BASE_URL}/chat/conversation/${conversationId}`,
        {
          method: 'POST',
          headers: {
            Cookie: cookieHeader,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            Origin: BASE_URL,
            Referer: `${BASE_URL}/chat/conversation/${conversationId}`,
          },
          body: formBuffer,
        },
      );

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HuggingChat API Error ${response.status}: ${txt}`);
      }

      const promptTokens = countMessagesTokens(messages);
      let completionTokens = 0;

      if (onMetadata) {
        onMetadata({
          conversation_id: conversationId,
          total_token: promptTokens,
        });
      }

      if (!response.body) throw new Error('No response body');

      let buffer = '';
      let isThinking = false;
      let fullContentBuffer = '';

      for await (const chunk of response.body as any) {
        const chunkStr = chunk.toString().replace(/\\u0000/g, '');
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.type === 'stream' && json.token) {
              const token = json.token;
              completionTokens += countTokens(token);
              fullContentBuffer += token;

              // Check for thinking tags
              let processToken = token;

              // Simple state machine for thinking tags
              if (
                !isThinking &&
                fullContentBuffer.includes('<think>') &&
                !fullContentBuffer.includes('</think>')
              ) {
                isThinking = true;
                // Find where <think> starts in the current token if possible, or just switch mode
                // For simplicity, if we just switched to thinking, subsequent tokens are thinking
              }

              // More robust parsing:
              // Since tokens are small, we can check the full accumulated content to decide mode
              // and extract only the new parts.

              if (
                fullContentBuffer.includes('<think>') &&
                !fullContentBuffer.includes('</think>')
              ) {
                isThinking = true;
                if (onThinking) {
                  // Extract only the part after <think> if <think> was just added
                  const thinkStartIdx = fullContentBuffer.indexOf('<think>');
                  const thinkingContent = fullContentBuffer.substring(
                    thinkStartIdx + 7,
                  );
                  // Since we want to stream, we need to know what was already sent.
                  // This is getting complex for a simple loop.
                  // Let's use a simpler approach: check if the current token contains the tags.
                }
              }

              // RE-SIMPLIFIED LOGIC:
              if (token.includes('<think>')) {
                isThinking = true;
                const [before, after] = token.split('<think>');
                if (before) onContent(before);
                if (after && onThinking) onThinking(after);
                else if (after) onContent(after); // Fallback
              } else if (token.includes('</think>')) {
                isThinking = false;
                const [before, after] = token.split('</think>');
                if (before && onThinking) onThinking(before);
                else if (before) onContent(before);
                if (after) onContent(after);
              } else {
                if (isThinking && onThinking) {
                  onThinking(token);
                } else {
                  onContent(token);
                }
              }

              if (onMetadata) {
                onMetadata({ total_token: promptTokens + completionTokens });
              }
            } else if (json.type === 'finalAnswer') {
              // Finalize
            } else if (json.type === 'title' && json.title && onMetadata) {
              onMetadata({ conversation_title: json.title });
            }
          } catch (e) {
            // Ignore parse errors for partial lines
          }
        }
      }
      onDone();
    } catch (err: any) {
      onError(err);
    }
  }

  async getConversations(
    credential: string,
    limit: number = 30,
  ): Promise<any[]> {
    const client = this.createClient(credential);
    const res = await client.get('/chat/api/v2/conversations?p=0');
    const data = await res.json();
    const list = data.json?.conversations || data.conversations || [];
    return list.slice(0, limit);
  }

  async getConversationDetail(
    credential: string,
    conversationId: string,
  ): Promise<any> {
    const client = this.createClient(credential);
    const res = await client.get(
      `/chat/api/v2/conversations/${conversationId}`,
    );
    const data = await res.json();
    const detail = data.json || data;

    const messages = (detail.messages || []).map((m: any) => ({
      id: m.id,
      role:
        m.from === 'user'
          ? 'user'
          : m.from === 'assistant'
            ? 'assistant'
            : 'system',
      content: m.content || '',
      timestamp: m.createdAt || Date.now() / 1000,
    }));

    const total_token = countMessagesTokens(messages);

    return {
      conversation_id: detail.id,
      conversation_title: detail.title || 'Untitled',
      updated_at: detail.updatedAt || Date.now() / 1000,
      total_token,
      messages,
    };
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
    logger.info('[DEBUG] HuggingChat getModels called');
    try {
      const client = this.createClient(credential);
      const res = await client.get('/chat/api/v2/models');
      const data = await res.json();
      logger.info(
        `[DEBUG] Models API response received: ${JSON.stringify(data).substring(0, 200)}...`,
      );

      // Parse models from API response
      // HuggingChat API returns: {"json": [models array]}
      const modelsList = data.json || data.models || data || [];
      logger.info(
        `[DEBUG] Models list type: ${Array.isArray(modelsList)}, length: ${modelsList.length}`,
      );

      const models = modelsList.map((model: any) => {
        // Extract context_length from providers array if available
        let contextLength: number | null = null;
        if (model.providers && Array.isArray(model.providers)) {
          for (const provider of model.providers) {
            if (provider.context_length) {
              contextLength = provider.context_length;
              break;
            }
          }
        }

        return {
          id: model.id,
          name: model.displayName || model.name || model.id,
          // HuggingChat API doesn't provide thinking mode info, default to false
          is_thinking: false,
          context_length: contextLength,
        };
      });

      return models;
    } catch (error) {
      logger.error('Error fetching models from HuggingChat API:', error);
      throw error;
    }
  }

  private createClient(cookie: string) {
    return new HttpClient({
      baseURL: BASE_URL,
      headers: {
        Cookie: cookie,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
  }

  registerRoutes(router: Router) {
    router.get('/conversations', async (req, res) => {
      const account = findAccount(req, 'HuggingChat');
      if (!account) return res.status(401).json({ error: 'No account' });
      try {
        const list = await this.getConversations(account.credential, 30);
        res.json(list);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    router.get('/conversations/:id', async (req, res) => {
      const account = findAccount(req, 'HuggingChat');
      if (!account) return res.status(401).json({ error: 'No account' });
      try {
        const detail = await this.getConversationDetail(
          account.credential,
          req.params.id,
        );
        res.json(detail);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });
  }
}
