import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import { randomUUID } from 'crypto';

const logger = createLogger('QwqProvider');

export class QwqProvider implements Provider {
  name = 'QWQ';
  defaultModel = '';

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { messages, model, onContent, onDone, onError } = options;

    logger.info('[QWQ] handleMessage called');
    logger.info(`[QWQ] Model: ${model}`);

    const payload = {
      chatSessionId: randomUUID(),
      messages: messages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      model: model,
    };

    try {
      logger.info(`[QWQ] Sending request payload: ${JSON.stringify(payload)}`);

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

      logger.info(`[QWQ] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[QWQ] API Error Body: ${errorText}`);
        throw new Error(`QWQ API returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      let buffer = '';
      logger.info('[QWQ] Starting stream processing...');

      for await (const chunk of response.body) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.substring(6);
            if (dataStr === '[DONE]') {
              logger.info('[QWQ] Received [DONE] signal');
              continue;
            }

            try {
              const json = JSON.parse(dataStr);
              if (json.content) {
                // logger.debug(`[QWQ] Content chunk: ${json.content.substring(0, 20)}...`);
                onContent(json.content);
              }
            } catch (e) {
              logger.warn(`[QWQ] JSON parsing error for chunk: ${dataStr}`, e);
            }
          }
        }
      }

      logger.info('[QWQ] Stream processing finished');
      onDone();
    } catch (err: any) {
      logger.error('[QWQ] Error in handleMessage:', err);
      onError(err);
    }
  }

  async getModels(): Promise<any[]> {
    logger.info('[QWQ] getModels called');
    const models: any[] = [];

    try {
      // Fetch the static JS file containing model definitions
      const jsUrl =
        'https://qwq32.com/_next/static/chunks/8908-9588eff3feac75ec.js';
      const response = await fetch(jsUrl, {
        headers: {
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        logger.warn(`[QWQ] Failed to fetch static JS: ${response.status}`);
        return [];
      }

      const text = await response.text();

      // Look for JSON-like objects with id and name properties
      // Pattern: {"id":"some-id","name":"Some Name"
      const regex = /\{"id":"([^"]+)","name":"([^"]+)"/g;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const id = match[1];
        const name = match[2];

        // Only include free models or deepseek models as seemingly intended
        if (id.includes('free') || id.includes('deepseek')) {
          models.push({
            id: id,
            name: name,
            // Default values since we can't easily parse specific attributes from regex without more complex parsing
            context_length: 32000,
            is_thinking: false,
          });
        }
      }

      logger.info(`[QWQ] Extracted ${models.length} models from static JS`);
    } catch (error) {
      logger.error('[QWQ] Error fetching/parsing models from JS:', error);
    }

    logger.info(`[QWQ] Returning models: ${JSON.stringify(models)}`);
    return models;
  }

  registerRoutes(_router: Router) {
    // No extra routes needed
  }

  isModelSupported(model: string): boolean {
    return model.includes('deepseek-r1-0528');
  }
}
