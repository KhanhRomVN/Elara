import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import jwt from 'jsonwebtoken';

const logger = createLogger('KimiProvider');

const BASE_URL = 'https://www.kimi.com';
const API_BASE = `${BASE_URL}/apiv2`;

export class KimiProvider implements Provider {
  name = 'Kimi';
  defaultModel = 'K2.5 Thinking';

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onThinking,
      onDone,
      onError,
      conversationId,
    } = options;

    try {
      logger.info(`[Kimi] handleMessage called with model: ${model}`);

      // Extract JWT token from cookies
      const token = this.extractToken(credential);
      if (!token) {
        throw new Error('No valid Kimi token found in credentials');
      }

      // Check if token is expiring soon
      if (this.isTokenExpiringSoon(token)) {
        logger.warn('[Kimi] Token is expiring soon (< 7 days)');
        // TODO: Trigger auto-refresh in future implementation
      }

      // Determine if this is a thinking model
      const isThinkingModel = model?.toLowerCase().includes('thinking');

      // Prepare request payload
      const payload: any = {
        messages: messages.map((m) => ({
          role: m.role.toLowerCase(),
          content: m.content,
        })),
        model: model || this.defaultModel,
        stream: true,
        thinking: isThinkingModel,
      };

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      logger.info(`[Kimi] Sending request to chat API`);

      const response = await fetch(
        `${API_BASE}/kimi.chat.v1.ChatService/SendMessage`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Cookie: credential,
            'Content-Type': 'application/json',
            Origin: BASE_URL,
            Referer: `${BASE_URL}/chat`,
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[Kimi] API Error: ${response.status} - ${errorText}`);
        throw new Error(`Kimi API returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      let buffer = '';
      let thinkingBuffer = '';
      let inThinkingMode = false;

      logger.info('[Kimi] Starting stream processing...');

      for await (const chunk of response.body) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // Handle SSE format
          if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.substring(6);
            if (dataStr === '[DONE]') {
              logger.info('[Kimi] Received [DONE] signal');
              continue;
            }

            try {
              const json = JSON.parse(dataStr);

              // Handle thinking content
              if (json.thinking && onThinking) {
                inThinkingMode = true;
                thinkingBuffer += json.thinking;
                onThinking(json.thinking);
              }

              // Handle regular content
              if (json.content) {
                if (inThinkingMode && json.content.includes('</think>')) {
                  inThinkingMode = false;
                }
                onContent(json.content);
              }

              // Handle delta format (similar to OpenAI)
              if (json.choices && json.choices[0]?.delta?.content) {
                const content = json.choices[0].delta.content;
                onContent(content);
              }
            } catch (e) {
              logger.warn(`[Kimi] JSON parsing error: ${dataStr}`, e);
            }
          }
        }
      }

      logger.info('[Kimi] Stream processing finished');
      onDone();
    } catch (err: any) {
      logger.error('[Kimi] Error in handleMessage:', err);
      onError(err);
    }
  }

  async getModels(credential: string): Promise<any[]> {
    logger.info('[Kimi] Fetching models...');

    try {
      const token = this.extractToken(credential);
      if (!token) {
        logger.warn('[Kimi] No token found, returning fallback models');
        return this.getFallbackModels();
      }

      const response = await fetch(
        `${API_BASE}/kimi.gateway.config.v1.ConfigService/GetAvailableModels`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Cookie: credential,
            'Content-Type': 'application/json',
            Origin: BASE_URL,
            Referer: BASE_URL,
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `[Kimi] Models API Error: ${response.status} - ${errorText}`,
        );
        return this.getFallbackModels();
      }

      const data = await response.json();
      const availableModels = data.availableModels || [];

      logger.info(`[Kimi] Fetched ${availableModels.length} models`);

      return availableModels.map((model: any) => ({
        id: model.scenario || model.displayName,
        name: model.displayName,
        description: model.description,
        is_thinking: model.thinking === true,
        context_length: 200000, // Kimi supports 200k context
        legacy: model.legacy === true,
        agent_mode: model.agentMode || null,
      }));
    } catch (error) {
      logger.error('[Kimi] Error fetching models:', error);
      return this.getFallbackModels();
    }
  }

  async getConversations(
    credential: string,
    limit: number = 5,
  ): Promise<any[]> {
    logger.info(`[Kimi] Fetching conversations (limit: ${limit})...`);

    try {
      const token = this.extractToken(credential);
      if (!token) {
        throw new Error('No valid token found');
      }

      const response = await fetch(
        `${API_BASE}/kimi.chat.v1.ChatService/ListChats`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Cookie: credential,
            'Content-Type': 'application/json',
            Origin: BASE_URL,
            Referer: BASE_URL,
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({
            project_id: '',
            page_size: limit,
            query: '',
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `[Kimi] Conversations API Error: ${response.status} - ${errorText}`,
        );
        return [];
      }

      const data = await response.json();
      const chats = data.chats || [];

      logger.info(`[Kimi] Fetched ${chats.length} conversations`);

      return chats.map((chat: any) => ({
        id: chat.id,
        title: chat.name,
        created_at: chat.createTime,
        updated_at: chat.updateTime,
        message_preview: chat.messageContent,
      }));
    } catch (error) {
      logger.error('[Kimi] Error fetching conversations:', error);
      return [];
    }
  }

  registerRoutes(_router: Router) {
    // No extra routes needed for now
  }

  isModelSupported(model: string): boolean {
    return (
      model.toLowerCase().includes('k2') ||
      model.toLowerCase().includes('kimi') ||
      model.includes('SCENARIO_K2')
    );
  }

  // Helper methods

  private extractToken(credential: string): string | null {
    // Try to extract from cookie string
    const match = credential.match(/kimi-auth=([^;]+)/);
    if (match && match[1]) {
      return match[1];
    }

    // If credential is already a token
    if (credential.startsWith('eyJ')) {
      return credential;
    }

    return null;
  }

  private isTokenExpiringSoon(token: string): boolean {
    try {
      const decoded: any = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      const timeLeft = decoded.exp - now;
      const daysLeft = timeLeft / 86400;

      logger.info(`[Kimi] Token expires in ${daysLeft.toFixed(1)} days`);

      return daysLeft < 7;
    } catch (error) {
      logger.error('[Kimi] Error checking token expiration:', error);
      return false;
    }
  }

  private getFallbackModels(): any[] {
    return [
      {
        id: 'SCENARIO_K2D5',
        name: 'K2.5 Instant',
        description: 'Quick response',
        is_thinking: false,
        context_length: 200000,
      },
      {
        id: 'SCENARIO_K2D5_THINKING',
        name: 'K2.5 Thinking',
        description: 'Deep thinking for complex questions',
        is_thinking: true,
        context_length: 200000,
      },
      {
        id: 'SCENARIO_OK_COMPUTER',
        name: 'K2.5 Agent',
        description: 'Research, slides, websites, docs, sheets',
        is_thinking: false,
        context_length: 200000,
        agent_mode: 'TYPE_NORMAL',
      },
    ];
  }
}
