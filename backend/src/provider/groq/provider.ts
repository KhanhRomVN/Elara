import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GroqProvider');

export class GroqProvider implements Provider {
  name = 'Groq';
  defaultModel = 'llama-3.3-70b-versatile';

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
      logger.info(`Sending message to Groq model: ${payload.model}`);

      // Groq uses OpenAI-compatible API but validates the session cookie if using the browser session?
      // Or does it use the API key?
      // The Electron proxy captures cookies. The backend receives these cookies as 'credential'.
      // If we are using the browser session, we might need to hit the console endpoint or a specific API endpoint that accepts cookies.
      // However, usually Groq provides an API key.
      // If the user logged in via browser, we have cookies.

      // Let's assume for now we use the official API endpoint but pass the cookies?
      // Actually, if we have cookies, we are likely mimicking the browser client.
      // Browse logic usually goes to https://api.groq.com/openai/v1/chat/completions or similar.
      // But if we are using "crendital" which is a cookie string, we should use that in the Cookie header.

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Cookie: credential, // Use the full cookie string
            'Content-Type': 'application/json',
            Origin: 'https://console.groq.com',
            Referer: 'https://console.groq.com/',
            // We might need an X-Csrf-Token or similar if it's browser automated.
            // But let's start with standard headers.
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        // Try the playground endpoint if the public API fails with cookies
        const errorText = await response.text();
        logger.warn(
          `Public API failed with cookies: ${response.status}. Trying alternative...`,
        );

        // NOTE: Real implementation might need to align with how Electron proxy works.
        // For now, let's report error if this fails.
        throw new Error(`Groq API returned ${response.status}: ${errorText}`);
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
    logger.info(
      `Fetching Groq models dynamically... Credential length: ${credential?.length}`,
    );
    try {
      // credential is the full cookie string
      let token = '';

      // Try to extract stytch_session_jwt from cookies
      // Regex handles beginning of string or after semicolon, allows optional whitespace
      const match = credential.match(/(?:^|;\s*)stytch_session_jwt=([^;]+)/);
      if (match && match[1]) {
        token = match[1];
        logger.info('Successfully extracted stytch_session_jwt');
      } else {
        logger.warn('Could not find stytch_session_jwt in credential string');
      }

      // If no token found in cookies, assume credential itself might be a token (fallback)
      if (!token && !credential.includes('=')) {
        token = credential;
        logger.info('Using credential directly as token');
      }

      if (!token) {
        logger.warn('No session token found in credentials for Groq');
        return this.getFallbackModels('Check Logs: No Token Found');
      }

      try {
        const decoded: any = jwt.decode(token);
        if (decoded && decoded.exp) {
          const expTime = new Date(decoded.exp * 1000);
          const now = new Date();
          const timeLeft = (expTime.getTime() - now.getTime()) / 1000;

          logger.info(
            `Token Expiration: ${expTime.toISOString()} (${timeLeft.toFixed(0)}s left)`,
          );

          if (timeLeft <= 0) {
            logger.warn('Token has EXPIRED!');
          }
        }
      } catch (e) {
        logger.warn('Failed to decode token for debug log', e);
      }

      // Try to extract organization from user-preferences
      let organization = '';
      const preferencesMatch = credential.match(
        /(?:^|;\s*)user-preferences=([^;]+)/,
      );
      if (preferencesMatch && preferencesMatch[1]) {
        try {
          const preferences = JSON.parse(
            decodeURIComponent(preferencesMatch[1]),
          );
          organization = preferences['current-org'];
        } catch (e) {
          logger.warn('Failed to parse user-preferences from cookie', e);
        }
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Cookie: credential,
        'Content-Type': 'application/json',
        Origin: 'https://console.groq.com',
        Referer: 'https://console.groq.com/',
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      };

      if (organization) {
        headers['groq-organization'] = organization;
      }

      const response = await fetch('https://api.groq.com/internal/v1/models', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const shortError = `API Error ${response.status}`;
        logger.error(
          `Groq Models API returned ${response.status}: ${errorText}`,
        );
        return this.getFallbackModels(
          shortError + ': ' + errorText.substring(0, 20),
        );
      }

      const json = await response.json();
      const modelsData = json.data || [];

      logger.info(`Fetched ${modelsData.length} models from Groq API`);

      if (!Array.isArray(modelsData)) {
        logger.error('Groq Models API returned invalid format');
        return this.getFallbackModels('Invalid API Format');
      }

      return modelsData
        .filter((model: any) => model.active !== false)
        .map((model: any) => ({
          id: model.id,
          name: model.metadata?.display_name || model.id,
          description: model.metadata?.model_card,
          context_length: model.context_window,
          is_thinking: model.features?.reasoning === true,
        }));
    } catch (e: any) {
      logger.error('Error fetching Groq models:', e);
      return this.getFallbackModels('Exception: ' + e.message);
    }
  }

  private getFallbackModels(debugError?: string) {
    const models: any[] = [];

    if (debugError) {
      models.unshift({
        id: 'debug-error',
        name: `⚠️ ${debugError}`,
        context_length: 0,
        is_thinking: false,
      });
    }
    return models;
  }

  registerRoutes(_router: Router) {
    // No extra routes needed
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('groq') || m.includes('llama') || m.includes('mixtral');
  }
}
