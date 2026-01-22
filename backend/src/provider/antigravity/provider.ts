import type { Provider, SendMessageOptions } from '../types';
import type { Message } from '../../types';
import { Router } from 'express';
import fetch, { Response } from 'node-fetch';
import https from 'https';
import crypto from 'crypto';
import { createLogger } from '../../utils/logger';
import { getDB } from '../../utils/database';

const logger = createLogger('AntigravityProvider');

const CLIENT_ID =
  '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || '';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Endpoints
const BASE_URL_PROD = 'https://cloudcode-pa.googleapis.com';
const BASE_URL_DAILY = 'https://daily-cloudcode-pa.sandbox.googleapis.com';
const BACKEND_URLS = [BASE_URL_PROD, BASE_URL_DAILY];

const httpsAgent = new https.Agent({ family: 4 });

export class AntigravityProvider implements Provider {
  name = 'Antigravity';
  defaultModel = 'gemini-3-flash';

  private accessTokenCache = new Map<
    string,
    { token: string; expires: number }
  >();

  private async fetchWithFallback(
    path: string,
    options: SendMessageOptions | any,
    accessToken: string,
  ): Promise<Response> {
    let lastError: Error | any;

    for (const baseUrl of BACKEND_URLS) {
      const url = `${baseUrl}${path}`;
      try {
        const res = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${accessToken}`,
          },
        });

        // If success, return response
        if (res.ok) return res;

        // If 401, throw immediately to trigger token refresh (don't fallback yet)
        if (res.status === 401) throw new Error('401');

        // Determine if we should fallback
        // We fallback on: 429 (Quota), 404 (Not Found on Prod), 5xx (Server Error)
        const shouldFallback =
          res.status === 429 || res.status === 404 || res.status >= 500;

        if (shouldFallback) {
          const txt = await res.text();
          logger.warn(
            `[Antigravity] Request to ${baseUrl} failed (${res.status}): ${txt}. Trying next endpoint...`,
          );
          lastError = new Error(`HTTP ${res.status}: ${txt}`);
          continue; // Try next URL
        }

        // Other errors (e.g. 400 Bad Request) -> return response as is (caller handles)
        return res;
      } catch (e: any) {
        if (e.message === '401') throw e;
        logger.warn(`[Antigravity] Network error for ${baseUrl}: ${e.message}`);
        lastError = e;
      }
    }

    throw lastError || new Error('All endpoints failed');
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      accountId,
      conversationId,
      onContent,
      onDone,
      onError,
      onSessionCreated,
      temperature,
    } = options;

    try {
      const accessToken = await this.getAccessToken(credential, accountId);

      const makeRequest = async (token: string) => {
        const projectID = await this.fetchProjectID(token);
        // Clean model name - remove 'models/' prefix if present
        let targetModel = this.alias2ModelName(model || this.defaultModel);
        if (targetModel.startsWith('models/')) {
          targetModel = targetModel.replace('models/', '');
        }

        // Use provided conversationId or generate a stable one from messages
        const sessionID =
          conversationId || this.generateStableSessionID(messages);

        const payload: Record<string, any> = {
          model: targetModel,
          userAgent: 'antigravity',
          requestType: 'agent',
          project: projectID,
          requestId: 'agent-' + crypto.randomUUID(),
          request: {
            sessionId: sessionID,
            contents: this.convertMessages(messages),
            toolConfig: {
              functionCallingConfig: {
                mode: 'VALIDATED',
              },
            },
            generationConfig: {
              temperature: temperature || 0.7,
              maxOutputTokens: 8192,
              candidateCount: 1,
              thinkingConfig: {
                thinkingBudget: 1024,
                include_thoughts: true,
              },
            },
          },
        };

        if (!targetModel.includes('gemini-3-pro')) {
          delete payload.request.generationConfig.thinkingConfig;
        }

        const response = await this.fetchWithFallback(
          '/v1internal:streamGenerateContent?alt=sse',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'antigravity/1.11.3 Darwin/arm64',
              'x-goog-api-client': 'antigravity/1.11.3',
              Accept: 'text/event-stream',
            },
            body: JSON.stringify(payload),
            agent: httpsAgent,
          },
          token,
        );

        if (!response.ok) {
          const txt = await response.text();
          throw new Error(`Antigravity API Error: ${response.status} ${txt}`);
        }

        // Notify session creation if it's new
        if (!conversationId && onSessionCreated) {
          onSessionCreated(sessionID);
        }

        return response;
      };

      try {
        const response = await makeRequest(accessToken);
        await this.handleStreamResponse(response, onContent, onDone);
      } catch (err: any) {
        if (
          (err.message === '401' || err.message.includes('401')) &&
          accountId
        ) {
          logger.info(
            `[Antigravity] Token expired during handleMessage, refreshing for ${accountId}...`,
          );
          const newTokens = await this.refreshTokens(credential, accountId);
          const response = await makeRequest(newTokens.access_token);
          await this.handleStreamResponse(response, onContent, onDone);
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      logger.error('Error in Antigravity handleMessage:', err);
      onError(err);
    }
  }

  private async handleStreamResponse(
    response: Response,
    onContent: (content: string) => void,
    onDone: () => void,
  ) {
    if (!response || !response.body) {
      throw new Error('No response body from Antigravity');
    }

    // Stream handling
    for await (const chunk of response.body) {
      const str = chunk.toString();
      const lines = str.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        let cleanLine = line.trim();
        if (cleanLine.startsWith('data: ')) cleanLine = cleanLine.substring(6);
        if (!cleanLine || cleanLine === '[DONE]') continue;

        try {
          const data = JSON.parse(cleanLine);
          let candidates = data.candidates;
          if (data.response && data.response.candidates) {
            candidates = data.response.candidates;
          }
          const cand = candidates?.[0];
          const parts = cand?.content?.parts;
          if (parts) {
            for (const p of parts) {
              if (p.text) onContent(p.text);
            }
          }
        } catch (e) {
          // ignore partial JSON
        }
      }
    }
    onDone();
  }

  private async getAccessToken(
    credential: string,
    accountId?: string,
  ): Promise<string> {
    // Always check cache first
    if (accountId) {
      const cached = this.accessTokenCache.get(accountId);
      if (cached && cached.expires > Date.now()) {
        logger.debug(
          `[Antigravity] Using cached access token for ${accountId}`,
        );
        return cached.token;
      }
    }

    try {
      const creds = JSON.parse(credential);
      if (creds.access_token) {
        return creds.access_token;
      }
    } catch {
      // Credential is plain refresh token string
    }

    if (accountId) {
      logger.info(
        `[Antigravity] No valid access token, refreshing for ${accountId}...`,
      );
      const newTokens = await this.refreshTokens(credential, accountId);
      return newTokens.access_token;
    }

    return credential;
  }

  private async refreshTokens(
    credential: string,
    accountId: string,
  ): Promise<any> {
    let refreshToken = credential;
    try {
      const creds = JSON.parse(credential);
      refreshToken = creds.refresh_token || credential;
    } catch {
      refreshToken = credential;
    }

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      agent: httpsAgent,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token refresh failed: ${text}`);
    }

    const newTokens = await res.json();

    if (accountId) {
      this.accessTokenCache.set(accountId, {
        token: newTokens.access_token,
        expires: Date.now() + (newTokens.expires_in - 60) * 1000,
      });
    }

    const db = getDB();
    const account = db.getById(accountId);
    if (account) {
      account.credential = newTokens.refresh_token || refreshToken;
      db.upsert(account);
      logger.info(
        `Successfully refreshed tokens for account ${accountId}. Stored plain refresh token in DB.`,
      );
    }

    return newTokens;
  }

  private async fetchProjectID(accessToken: string): Promise<string> {
    const payload = {
      metadata: {
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI',
      },
    };

    try {
      const res = await this.fetchWithFallback(
        '/v1internal:loadCodeAssist',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'antigravity/1.11.3 Darwin/arm64',
            'X-Goog-Api-Client': 'antigravity/1.11.3',
          },
          body: JSON.stringify(payload),
          agent: httpsAgent,
        },
        accessToken,
      );

      if (!res.ok) throw new Error('Failed to load code assist');

      const data = (await res.json()) as any;
      let pid = '';
      if (typeof data.cloudaicompanionProject === 'string') {
        pid = data.cloudaicompanionProject;
      } else if (
        data.cloudaicompanionProject &&
        data.cloudaicompanionProject.id
      ) {
        pid = data.cloudaicompanionProject.id;
      }
      return pid || `useful-fuze-${crypto.randomUUID().substring(0, 5)}`;
    } catch (e) {
      return `useful-fuze-${crypto.randomUUID().substring(0, 5)}`;
    }
  }

  private convertMessages(msgs: Message[]) {
    return msgs.map((m) => {
      const parts = [];
      if (m.content) {
        parts.push({ text: m.content });
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });
  }

  private generateStableSessionID(messages: any[]): string {
    const firstUserMsg = messages.find((m) => m.role === 'user');
    const text = firstUserMsg?.content || '';
    if (!text) {
      return '-' + Math.floor(Math.random() * 9000000000000000000).toString();
    }

    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const hexFirst8 = hash.substring(0, 16);
    const n = BigInt(`0x${hexFirst8}`) & BigInt('0x7FFFFFFFFFFFFFFF');
    return '-' + n.toString();
  }

  private alias2ModelName(modelName: string): string {
    let m = modelName;
    if (m.startsWith('models/')) m = m.replace('models/', '');
    switch (m) {
      case 'gemini-3-pro-preview':
        return 'gemini-3-pro-high';
      case 'gemini-3-flash-preview':
        return 'gemini-3-flash';
      default:
        return m;
    }
  }

  async getModels(credential: string, accountId?: string): Promise<any[]> {
    const fetchModels = async (token: string) => {
      // Must fetch project ID first for v1internal calls to work correctly?
      // Test script showed fetchAvailableModels *with* projectID returning full info.
      // Empty body resulted in 401 in app logs previously?
      const pid = await this.fetchProjectID(token);

      const res = await this.fetchWithFallback(
        '/v1internal:fetchAvailableModels',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'antigravity/1.11.3 Darwin/arm64',
          },
          body: JSON.stringify({ project: pid }),
          agent: httpsAgent,
        },
        token,
      );

      if (!res.ok) throw new Error('Failed to fetch models');
      const data = (await res.json()) as any;
      if (!data.models) return this.getDefaultModels();

      // Return all models found, relying on frontend or user to pick correct one
      // Or we could mix in our known good ones?
      // Let's return mapped models.
      return Object.entries(data.models).map(([key, val]: [string, any]) => ({
        id: key,
        name: val.displayName || key,
        description: val.description || '',
        context_length: val.inputTokenLimit || 32768,
      }));
    };

    try {
      const accessToken = await this.getAccessToken(credential, accountId);
      try {
        return await fetchModels(accessToken);
      } catch (e: any) {
        if (e.message === '401' && accountId) {
          logger.info(
            `[Antigravity] token expired for ${accountId} in getModels, refreshing...`,
          );
          const newTokens = await this.refreshTokens(credential, accountId);
          return await fetchModels(newTokens.access_token);
        }
        throw e;
      }
    } catch (e) {
      logger.error('Error fetching models for Antigravity:', e);
      return this.getDefaultModels();
    }
  }

  private getDefaultModels() {
    return [
      {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        description: 'Fast and versatile performance (Verified)',
        context_length: 32768,
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Next-gen fast model (Verified)',
        context_length: 32768,
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        description: 'Lightweight efficient model (Verified)',
        context_length: 32768,
      },
      {
        id: 'tab_flash_lite_preview',
        name: 'Tab Flash Lite',
        description: 'Code completion optimized (Verified)',
        context_length: 32768,
      },
      {
        id: 'gemini-3-pro-image',
        name: 'Gemini 3 Pro Image',
        description: 'Multimodal image generation (Verified)',
        context_length: 32768,
      },
      {
        id: 'gpt-oss-120b-medium',
        name: 'GPT OSS 120B',
        description: 'Open source 120B model (Verified)',
        context_length: 32768,
      },
      {
        id: 'rev19-uic3-1p',
        name: 'Rev19 UIC3 1P',
        description: 'Experimental model (Verified)',
        context_length: 32768,
      },
      // Fallbacks
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro (Preview)',
        description: 'Complex reasoning, coding, and creative collaboration',
        context_length: 32768,
      },
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash (Preview)',
        description: 'Fast and versatile performance for diverse tasks',
        context_length: 32768,
      },
    ];
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return (
      m.includes('gemini') ||
      m.includes('antigravity') ||
      m.includes('gpt-oss') ||
      m.includes('tab_flash') ||
      m.includes('rev19')
    );
  }

  registerRoutes(_router: Router) {}
}
