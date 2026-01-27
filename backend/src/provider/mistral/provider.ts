import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import * as https from 'https';
import * as crypto from 'crypto';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MistralProvider');

export class MistralProvider implements Provider {
  name = 'Mistral';
  defaultModel = 'mistral-large-latest';

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { credential, messages, onContent, onMetadata, onDone, onError } =
      options;
    const { conversationId } = options;

    try {
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage.content;

      // 1. Create chat if needed
      if (!conversationId) {
        await this.streamMistral(
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
        await this.streamMistral(
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
  }

  async getConversations(
    credential: string,
    limit: number = 30,
  ): Promise<any[]> {
    try {
      const html = await this.makeHttpsRequest('https://chat.mistral.ai/chat', {
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

      return conversations.slice(0, limit);
    } catch (error) {
      logger.error('Error fetching Mistral conversations', error);
      throw error;
    }
  }

  private async streamMistral(
    credential: string,
    chatId: string,
    mode: 'start' | 'append',
    content: string | null,
    onContent: (c: string) => void,
    onDone: () => void,
    onError: (e: any) => void,
  ) {
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
      payload.messageId = crypto.randomUUID();
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
  }

  private makeHttpsRequest(
    url: string,
    options: https.RequestOptions,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              // Try parsing JSON, fallback to text (for HTML scraping)
              // Mistral scraping needs text
              resolve(data);
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
  }

  registerRoutes(router: Router) {}

  isModelSupported(model: string): boolean {
    return model.toLowerCase().includes('mistral');
  }
}
