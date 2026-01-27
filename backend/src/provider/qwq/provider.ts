import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import { randomUUID } from 'crypto';

const logger = createLogger('QwqProvider');

export class QwqProvider implements Provider {
  name = 'QWQ';
  defaultModel = 'deepseek/deepseek-r1-0528:free';

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { messages, model, onContent, onDone, onError } = options;

    const payload = {
      chatSessionId: randomUUID(),
      messages: messages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      model: model || this.defaultModel,
    };

    try {
      logger.info(`Sending message to QWQ model: ${payload.model}`);

      const response = await fetch('https://qwq32.com/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          origin: 'https://qwq32.com',
          referer: 'https://qwq32.com/chat',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`QWQ API returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      let buffer = '';
      for await (const chunk of response.body) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith('data: ')) {
            try {
              const dataStr = trimmedLine.substring(6);
              if (dataStr === '[DONE]') continue;

              const json = JSON.parse(dataStr);
              if (json.content) {
                onContent(json.content);
              }
            } catch (e) {
              // ignore parse errors for partial lines
            }
          }
        }
      }

      onDone();
    } catch (err: any) {
      logger.error('Error in handleMessage:', err);
      onError(err);
    }
  }

  async getModels(): Promise<any[]> {
    return [
      {
        id: 'deepseek/deepseek-r1-0528:free',
        name: 'DeepSeek R1 (Free)',
        context_length: 32000,
        is_thinking: true,
      },
    ];
  }

  registerRoutes(_router: Router) {
    // No extra routes needed
  }

  isModelSupported(model: string): boolean {
    return model.includes('deepseek-r1-0528');
  }
}
