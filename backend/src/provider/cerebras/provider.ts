import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CerebrasProvider');

export class CerebrasProvider implements Provider {
  name = 'Cerebras';
  defaultModel = 'llama-3.3-70b';

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
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      stream: true,
    };

    if (typeof temperature === 'number') {
      payload.temperature = temperature;
    }

    try {
      logger.info(`Sending message to Cerebras model: ${payload.model}`);

      const response = await fetch(
        'https://api.cerebras.ai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Elara/1.0.0',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Cerebras API returned ${response.status}: ${errorText}`);
        throw new Error(
          `Cerebras API returned ${response.status}: ${errorText}`,
        );
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
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmedLine.substring(6));
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) {
                onContent(delta.content);
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

  async getModels(credential: string): Promise<any[]> {
    logger.info('Fetching Cerebras models...');
    try {
      // For now, we use a static list or fetch from GraphQL if needed.
      // Given the data in ceberas-auth.md, we can try to fetch from GraphQL.
      const resp = await fetch('https://chat.cerebras.ai/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credential}`, // Wait, it uses demoApiKey? Or session?
          // Actually ListModels used a session token but let's see if demoApiKey works.
          // Based on ceberas-auth.md, ListModels was sent to chat.cerebras.ai/api/graphql.
        },
        body: JSON.stringify({
          operationName: 'ListModels',
          variables: { organizationId: '**personal' },
          query:
            'query ListModels($organizationId: ID) {\n ListModels(organizationId: $organizationId) {\n id\n name\n description\n sortOrder\n modelVisibility\n __typename\n }\n}',
        }),
      });

      if (!resp.ok) {
        // Fallback to static list if GraphQL fails (maybe demoApiKey doesn't work for GraphQL)
        return [
          {
            id: 'llama-3.3-70b',
            name: 'Llama 3.3 70B',
            context_length: 128000,
          },
          { id: 'llama3.1-8b', name: 'Llama 3.1 8B', context_length: 128000 },
          { id: 'llama3.1-70b', name: 'Llama 3.1 70B', context_length: 128000 },
        ];
      }

      const json = await resp.json();
      return (json.data?.ListModels || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        context_length: 128000, // Common for Llama 3.1/3.3
      }));
    } catch (e) {
      logger.error('Error fetching models:', e);
      return [
        { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', context_length: 128000 },
        { id: 'llama3.1-8b', name: 'Llama 3.1 8B', context_length: 128000 },
        { id: 'llama3.1-70b', name: 'Llama 3.1 70B', context_length: 128000 },
        { id: 'qwen-3-32b', name: 'Qwen 3 32B', context_length: 32768 },
        {
          id: 'qwen-3-235b-a22b-instruct-2507',
          name: 'Qwen 3 235B Instruct',
          context_length: 32768,
        },
      ];
    }
  }

  registerRoutes(_router: Router) {
    // No extra routes needed for now
  }
}
