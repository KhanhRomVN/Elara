import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import { findAccount } from '../../services/account-selector';

const logger = createLogger('CohereProvider');

export class CohereProvider implements Provider {
  name = 'Cohere';
  defaultModel = 'command-r7b-12-2024';

  private async getApiKey(credential: string): Promise<string> {
    // If it's already a raw key (doesn't start with JWT prefix), return it
    if (!credential.startsWith('eyJ')) {
      logger.info('Credential is not a JWT, assuming it is a raw API key');
      return credential;
    }

    logger.info(
      `Exchanging JWT token for raw API key... (Token starts with: ${credential.substring(0, 10)})`,
    );

    try {
      const resp = await fetch(
        'https://production.api.os.cohere.com/rpc/BlobheartAPI/GetOrCreateDefaultAPIKey',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Elara/1.0.0',
            'request-source': 'playground',
          },
          body: JSON.stringify({ canReturnProductionKey: true }),
        },
      );

      if (!resp.ok) {
        const text = await resp.text();
        logger.error(`Failed to exchange token: ${resp.status} - ${text}`);
        return credential; // Fallback to original
      }

      const json = await resp.json();
      if (json.rawKey) {
        const masked =
          json.rawKey.substring(0, 5) +
          '...' +
          json.rawKey.substring(json.rawKey.length - 5);
        logger.info(`Successfully exchanged JWT for raw API key: ${masked}`);
        return json.rawKey;
      }
      logger.warn('Token exchange response did not contain rawKey');
      return credential;
    } catch (e) {
      logger.error('Error in getApiKey exchange:', e);
      return credential;
    }
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      stream,
      temperature,
      onContent,
      onDone,
      onError,
    } = options;

    const payload: any = {
      model: model || this.defaultModel,
      messages: messages.map((m) => ({
        role:
          m.role.toLowerCase() === 'assistant'
            ? 'assistant'
            : m.role.toLowerCase() === 'system'
              ? 'system'
              : 'user',
        content: m.content,
      })),
      stream: true,
    };

    if (typeof temperature === 'number') {
      payload.temperature = temperature;
    }

    if (options.thinking) {
      payload.thinking = { type: 'enabled' };
    }

    try {
      logger.info(`Sending message to Cohere model: ${payload.model}`);
      const apiKey = await this.getApiKey(credential);
      const response = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Elara/1.0.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Cohere API returned ${response.status}: ${errorText}`);
        throw new Error(`Cohere API returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      let buffer = '';
      const onThinking =
        options.onThinking ||
        ((chunk: string) => onContent(`[Thinking] ${chunk}`));

      for await (const chunk of response.body) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmedLine.substring(6));

              if (json.type === 'content-delta') {
                const content = json.delta?.message?.content;
                if (!content) continue;

                if (content.thinking !== undefined) {
                  onThinking(content.thinking);
                } else if (content.text !== undefined) {
                  onContent(content.text);
                }
              }
            } catch (e) {
              // ignore
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

  async getConversations(
    _credential: string,
    _limit: number = 30,
  ): Promise<any[]> {
    // Cohere standard API doesn't expose dashboard conversations easily
    return [];
  }

  async getConversationDetail(
    _credential: string,
    _conversationId: string,
  ): Promise<any> {
    return { messages: [] };
  }

  async getModels(credential: string): Promise<any[]> {
    logger.info('Fetching Cohere models...');
    try {
      const apiKey = await this.getApiKey(credential);
      const resp = await fetch(
        'https://api.cohere.com/v1/models?page_size=500&endpoint=chat',
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': 'Elara/1.0.0',
            'x-fern-runtime': 'browser',
          },
        },
      );
      if (!resp.ok) {
        const text = await resp.text();
        logger.error(`Error fetching models: ${resp.status} - ${text}`);
        return [];
      }
      const json = await resp.json();
      const count = (json.models || []).length;
      logger.info(`Fetched ${count} models from Cohere`);
      return (json.models || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        is_thinking: m.features?.includes('reasoning') || false,
        context_length: m.context_length || null,
      }));
    } catch (e) {
      logger.error('Error fetching models:', e);
      return [];
    }
  }

  registerRoutes(router: Router) {
    router.get('/sessions', async (req, res) => {
      try {
        const account = findAccount(req, 'Cohere');
        if (!account) return res.status(401).json({ error: 'No account' });
        const sessions = await this.getConversations(account.credential, 30);
        res.json(sessions);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });
  }
}
