import { Provider, SendMessageOptions } from '../../types';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import { loginService } from '../../services/login/login.service';
import { proxyEvents } from '../../services/proxy.service';
import { getDb } from '../../database';
import { updateAccountCredential } from '../../repositories/account.repository';
import { proxyHandler } from './qwen.proxy-handler';
import type { QwenCredential } from './qwen.types';

export { proxyHandler };

export const BASE_URL = 'https://chat.qwen.ai';

const logger = createLogger('QwenProvider');

// ---------------------------------------------------------------------------
// Per-session request lock: prevents concurrent requests from overlapping.
// Key = conversationId (or accountId for new chats without a conversationId).
// ---------------------------------------------------------------------------
const sessionLocks = new Map<string, Promise<void>>();

function acquireLock(key: string): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = sessionLocks.get(key) ?? Promise.resolve();
  // Chain: wait for the previous holder to finish, then this caller gets the slot
  sessionLocks.set(
    key,
    previous.then(() => next),
  );
  return { promise: previous, release };
}

import { StreamingThinkingParser } from '../../utils/thinking-parser';

// ---------------------------------------------------------------------------
// Per-conversation parent_id cache.
// Stores the last assistant response_id returned by Qwen, so the next turn
// can use it directly as parent_id WITHOUT calling getLastMessageId().
// This prevents "2/2 siblings" caused by Qwen API eventual consistency.
// ---------------------------------------------------------------------------
const lastParentIdCache = new Map<string, string>();

export class QwenProvider implements Provider {
  name = 'Qwen';
  proxyHandler = proxyHandler;
  defaultModel = 'qwen-3.8-max';

  // ===========================================================================
  // TOKEN HELPERS
  // ===========================================================================

  private parseCredential(credential: string): QwenCredential {
    if (credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential);
        const token = parsed.token || null;
        return {
          token,
          cookieValue: token ? `token=${token}` : '',
          bxUa: parsed.bxUa || '',
          bxUmidToken: parsed.bxUmidToken || '',
          userAgent:
            parsed.userAgent ||
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        };
      } catch {
        // fall through
      }
    }

    let token: string | null = null;
    let cookieValue = credential;
    if (credential.trim().startsWith('eyJ')) {
      token = credential.trim();
      cookieValue = `token=${token}`;
    } else {
      const m = credential.match(/(?:^|;\s*)token=(eyJ[^;]+)/);
      token = m ? m[1] : null;
    }

    return {
      token,
      cookieValue,
      bxUa: '',
      bxUmidToken: '',
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    };
  }

  private extractToken(credential: string): string | null {
    return this.parseCredential(credential).token;
  }

  private getTokenExpiry(jwt: string): number | null {
    try {
      const parts = jwt.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      );
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  private isTokenExpiringSoon(
    jwt: string,
    thresholdSecs = 7 * 24 * 3600,
  ): boolean {
    const exp = this.getTokenExpiry(jwt);
    if (exp === null) return false;
    return Date.now() / 1000 >= exp - thresholdSecs;
  }

  async refreshToken(credential: string): Promise<string | null> {
    const token = this.extractToken(credential);
    if (!token) return null;

    const cookieValue = credential.includes('token=')
      ? credential
      : `token=${token}`;

    try {
      logger.info('[Qwen] Attempting token refresh via /api/v1/auths/');
      const response = await fetch('https://chat.qwen.ai/api/v1/auths/', {
        method: 'GET',
        headers: {
          Cookie: cookieValue,
          Authorization: `Bearer ${token}`,
          accept: 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          source: 'web',
          version: '0.2.64',
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        logger.warn(`[Qwen] Token refresh failed: HTTP ${response.status}`);
        return null;
      }

      const json: any = await response.json();
      const userData = json.data ?? json;
      const newToken: string | undefined = userData?.token;

      if (!newToken) {
        logger.warn('[Qwen] Token refresh response had no token field');
        return null;
      }

      if (newToken === token) {
        logger.debug('[Qwen] Token refresh returned same token — still valid');
        return newToken;
      }

      logger.info('[Qwen] Token refreshed successfully');

      const email: string | undefined = userData?.email;
      if (email) {
        try {
          const db = getDb();
          const accounts = db
            .prepare(
              "SELECT * FROM accounts WHERE LOWER(provider_id) = 'qwen' AND LOWER(email) = ?",
            )
            .all(email.toLowerCase()) as any[];
          for (const acc of accounts) {
            updateAccountCredential(acc.id, newToken);
          }
        } catch (e) {
          logger.error('[Qwen] Failed to persist refreshed token to DB:', e);
        }
      }

      return newToken;
    } catch (e) {
      logger.error('[Qwen] Token refresh error:', e);
      return null;
    }
  }

  private async getFreshCredential(credential: string): Promise<string> {
    const token = this.extractToken(credential);
    if (!token) return credential;

    if (!this.isTokenExpiringSoon(token)) return credential;

    const exp = this.getTokenExpiry(token);
    const daysLeft = exp ? Math.round((exp - Date.now() / 1000) / 86400) : null;
    logger.info(
      `[Qwen] Token expiring soon (${daysLeft !== null ? daysLeft + ' days left' : 'already expired'}), refreshing...`,
    );

    const newToken = await this.refreshToken(credential);
    if (!newToken) {
      logger.warn('[Qwen] Refresh failed, proceeding with existing credential');
      return credential;
    }
    return newToken;
  }

  async login() {
    logger.info('Starting Qwen login...');

    let capturedHeaders: Record<string, string> = {};
    const self = this;

    const onHeaders = (headers: Record<string, string>) => {
      capturedHeaders = { ...capturedHeaders, ...headers };
      logger.debug('[Qwen] Captured headers:', headers);
    };

    proxyEvents.on('qwen-headers', onHeaders);

    try {
      return await loginService.login({
        providerId: 'qwen',
        loginUrl: 'https://chat.qwen.ai/auth',
        partition: `qwen-${Date.now()}`,
        cookieEvent: 'qwen-login-token',
        infoEvent: 'qwen-login-email',
        extraEvents: ['qwen-headers', 'qwen-cookies'],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          const isRawToken = data.cookies.trim().startsWith('eyJ');

          if (!isRawToken) {
            const hasBxUa = capturedHeaders['bx-ua'];
            if (!hasBxUa) {
              logger.debug('[Qwen] Waiting for bx-ua header...');
              return { isValid: false };
            }

            if (!capturedHeaders['x-csrf-token']) {
              const csrfMatch = data.cookies.match(/csrfToken=([^;]+)/);
              if (csrfMatch) {
                capturedHeaders['x-csrf-token'] = csrfMatch[1];
              }
            }
          }

          let email = data.email || null;

          const bxUa = capturedHeaders['bx-ua'];
          const isFallback =
            bxUa &&
            typeof bxUa === 'string' &&
            (bxUa.includes('default') ||
              bxUa.includes('_load_failed') ||
              bxUa.includes('not_initialized') ||
              bxUa.includes('not_fun'));
          const isRealBxUa =
            bxUa &&
            typeof bxUa === 'string' &&
            /^\d+!/.test(bxUa) &&
            bxUa.length > 100 &&
            !isFallback;

          if (isFallback || !isRealBxUa) {
            logger.info('[Qwen] Detected fallback headers, triggering list chats...');
            try {
              await self.fetchListChats(data.cookies, capturedHeaders);
            } catch (e) {
              logger.warn('[Qwen] Failed to fetch list chats:', e);
            }
          }

          if (!email) {
            logger.info('[Qwen] Email not captured directly, fetching profile...');
            try {
              const profile = await this.getProfile(data.cookies, capturedHeaders);
              if (profile.email) {
                email = profile.email;
              }
            } catch (e) {}
          }

          return {
            isValid: true,
            cookies: JSON.stringify({
              token: data.cookies.trim().startsWith('eyJ')
                ? data.cookies.trim()
                : (data.cookies.match(/token=(eyJ[^;]+)/) || [])[1] ||
                  data.cookies,
              bxUa: capturedHeaders['bx-ua'] || '',
              bxUmidToken: capturedHeaders['bx-umidtoken'] || '',
              userAgent: capturedHeaders['User-Agent'] || '',
            }),
            email,
            headers: capturedHeaders,
          };
        },
      });
    } finally {
      proxyEvents.off('qwen-headers', onHeaders);
    }
  }

  private async fetchListChats(
    credential: string,
    headersRef: Record<string, string>,
  ): Promise<void> {
    try {
      let token: string | null = null;
      let cookieValue = credential;

      if (credential.trim().startsWith('eyJ')) {
        token = credential.trim();
        if (!credential.includes('token=')) cookieValue = `token=${token}`;
      } else {
        const tokenMatch = credential.match(/token=([^;]+)/);
        token = tokenMatch ? tokenMatch[1] : null;
      }

      if (!token) {
        logger.warn('[Qwen] Cannot fetch list chats: no token found');
        return;
      }

      const headers: Record<string, string> = {
        Cookie: cookieValue,
        'User-Agent':
          headersRef['User-Agent'] ||
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        source: 'web',
        version: '0.2.64',
        'bx-v': '2.5.36',
        'x-request-id': crypto.randomUUID(),
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (headersRef['bx-ua']) headers['bx-ua'] = headersRef['bx-ua'];
      if (headersRef['bx-umidtoken'])
        headers['bx-umidtoken'] = headersRef['bx-umidtoken'];

      const response = await fetch(
        `${BASE_URL}/api/v2/chats/?page=1&exclude_project=true`,
        { headers },
      );

      if (response.ok) {
        logger.info('[Qwen] List chats fetched successfully');
      } else {
        logger.warn(`[Qwen] Failed to fetch list chats: ${response.status}`);
      }
    } catch (error) {
      logger.error('[Qwen] Error fetching list chats:', error);
      throw error;
    }
  }

  async getProfile(
    credential: string,
    extraHeaders?: any,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      let token: string | null = null;
      let cookieValue = credential;

      if (credential.trim().startsWith('eyJ')) {
        token = credential.trim();
        if (!credential.includes('token=')) cookieValue = `token=${token}`;
      } else {
        const tokenMatch = credential.match(/token=([^;]+)/);
        token = tokenMatch ? tokenMatch[1] : null;
      }

      const headers: Record<string, string> = {
        Cookie: cookieValue,
        'User-Agent':
          extraHeaders?.['User-Agent'] ||
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        accept: 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        source: 'web',
        version: '0.2.64',
      };
      if (extraHeaders?.['bx-ua']) headers['bx-ua'] = extraHeaders['bx-ua'];
      if (extraHeaders?.['x-csrf-token'])
        headers['x-csrf-token'] = extraHeaders['x-csrf-token'];
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('https://chat.qwen.ai/api/v1/auths/', {
        headers,
      });

      if (response.ok) {
        const json: any = await response.json();
        const userData = json.data ?? json;
        return {
          email: userData?.email || null,
          name: userData?.name,
          id: userData?.id,
        };
      }
      return { email: null };
    } catch (e) {
      logger.error('[Qwen] Get Profile Error:', e);
      return { email: null };
    }
  }

  private async createChat(
    credential: string,
    token: string | null,
    cookieValue: string,
    bxUa: string,
    bxUmidToken: string,
    userAgent: string,
    model: string = this.defaultModel,
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'User-Agent': userAgent,
      Cookie: cookieValue,
      source: 'web',
      version: '0.2.64',
      'Referer': `${BASE_URL}/c/new-chat`,
      'Origin': BASE_URL,
      'X-Request-Id': crypto.randomUUID(),
      'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'Accept-Language': 'en-US,en;q=0.9',
      'Timezone': new Date().toDateString() + ' ' + new Date().toTimeString().split(' ')[0] + ' GMT+0700',
      'bx-v': '2.5.36',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (bxUa) headers['bx-ua'] = bxUa;
    if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

    logger.info(`[Qwen] Creating new chat via POST /api/v2/chats/new with model: ${model}`);
    
    const response = await fetch(`${BASE_URL}/api/v2/chats/new`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        models: [model],
        title: 'New Chat',
      }),
    });

    const actualStatusCode = response.headers.get('x-actual-status-code');
    if (actualStatusCode && actualStatusCode !== '200') {
      const errorText = await response.text();
      throw new Error(`Create chat failed: ${actualStatusCode} - ${errorText}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Create chat failed: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    const chatId = json.data?.id || json.id;
    
    if (!chatId) {
      throw new Error(`No chat_id in response: ${JSON.stringify(json)}`);
    }

    logger.info(`[Qwen] Chat created successfully: ${chatId}`);
    return chatId;
  }

  private async getLastMessageId(
    conversationId: string,
    cookieValue: string,
    token: string | null,
    bxUa: string,
    bxUmidToken: string,
    userAgent: string,
  ): Promise<string | null> {
    const headers: Record<string, string> = {
      Cookie: cookieValue,
      'User-Agent': userAgent,
      accept: 'application/json',
      source: 'web',
      version: '0.2.64',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (bxUa) headers['bx-ua'] = bxUa;
    if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

    const response = await fetch(
      `${BASE_URL}/api/v2/chats/${conversationId}/messages/`,
      { headers },
    );
    if (!response.ok) return null;

    const json = await response.json();
    const messages = json.messages || json.data || [];
    if (messages.length > 0) {
      const lastAssistant = [...messages]
        .reverse()
        .find((m: any) => m.role === 'assistant');
      return lastAssistant?.id || null;
    }
    return null;
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { messages, onContent, onThinking, onMetadata, onDone, onError } = options;
    const onSessionCreated = options.onSessionCreated;
    let { conversationId } = options;

    // Normalize model name (strip provider/ prefix if present, e.g. 'qwen/qwen-3.8-max' -> 'qwen3.8-max')
    let modelToUse = options.model || this.defaultModel;
    if (modelToUse.includes('/')) {
      modelToUse = modelToUse.split('/').pop() || modelToUse;
    }
    modelToUse = modelToUse.trim();

    // Map qwen-3.x -> qwen3.x for upstream Qwen API
    if (modelToUse.startsWith('qwen-3.')) {
      modelToUse = modelToUse.replace('qwen-', 'qwen');
    }

    // Determine lock key:
    //  - If we already have a conversationId, lock on it so concurrent turns
    //    for the same chat are serialized (prevents duplicate parentId / stream interleave).
    //  - If this is a NEW chat, lock on accountId so two concurrent new-chat
    //    requests on the same account don't both call createChat() simultaneously.
    const lockKey = conversationId || options.accountId || 'qwen_default';
    const { promise: previousLock, release } = acquireLock(lockKey);

    try {
      // Wait for any in-flight request on the same session to finish first
      await previousLock;

      const credential = await this.getFreshCredential(options.credential);
      const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
        this.parseCredential(credential);

      const isNewChat = !conversationId;
      
      // Qwen API REQUIRES chat_id for EVERY request, even the first one.
      // So we MUST create a chat first before sending any message.
      if (isNewChat) {
        logger.info(`[Qwen] No conversationId provided, creating new chat first with model ${modelToUse}...`);
        conversationId = await this.createChat(
          credential,
          token,
          cookieValue,
          bxUa,
          bxUmidToken,
          userAgent,
          modelToUse,
        );
        if (onSessionCreated) onSessionCreated(conversationId);
        if (onMetadata) onMetadata({ conversation_id: conversationId });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const requestId = crypto.randomUUID();
      const timezone = `${new Date().toDateString()} ${new Date().toTimeString().split(' ')[0]} GMT+0700`;

      const lastMsg = messages[messages.length - 1];
      const msgFid = crypto.randomUUID();

      let parentId: string | null = options.parent_message_id ?? null;

      if (!parentId && conversationId && !isNewChat) {
        // 1st priority: use our server-side cache (set from the previous turn's response_id).
        //   This avoids Qwen API eventual-consistency issues where getLastMessageId()
        //   might return a stale value if called immediately after the previous response.
        const cached = lastParentIdCache.get(conversationId);
        if (cached) {
          parentId = cached;
          logger.debug(`[Qwen] Using cached parentId for ${conversationId}: ${parentId}`);
        } else {
          // 2nd priority: fall back to fetching from Qwen API (first continuation, no cache yet)
          try {
            parentId = await this.getLastMessageId(
              conversationId,
              cookieValue,
              token,
              bxUa,
              bxUmidToken,
              userAgent,
            );
            logger.debug(`[Qwen] Fetched parentId from API for ${conversationId}: ${parentId}`);
          } catch (e) {
            logger.warn('[Qwen] Failed to fetch last message ID');
          }
        }
      }

      const payload = {
        stream: true,
        version: '2.1',
        incremental_output: true,
        ...(conversationId && { chat_id: conversationId }),
        chat_mode: 'normal',
        model: modelToUse,
        parent_id: parentId as string | null,
        messages: [
          {
            fid: msgFid,
            parentId: parentId as string | null,
            childrenIds: [] as string[],
            role: lastMsg.role,
            content: lastMsg.content,
            user_action: 'chat',
            files: [],
            timestamp: nowSec,
            models: [modelToUse],
            chat_type: 't2t',
            feature_config: {
              thinking_enabled: false,
              output_schema: 'phase',
              research_mode: 'normal',
              auto_thinking: false,
              thinking_mode: 'Fast',
              auto_search: true,
            },
            extra: { meta: { subChatType: 't2t' } },
            sub_chat_type: 't2t',
          },
        ],
        timestamp: nowSec,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'User-Agent': userAgent,
        Origin: BASE_URL,
        Referer: conversationId ? `${BASE_URL}/c/${conversationId}` : BASE_URL,
        'x-accel-buffering': 'no',
        'x-request-id': requestId,
        Cookie: cookieValue,
        source: 'web',
        version: '0.2.64',
        'bx-v': '2.5.36',
        timezone,
        'accept-language': 'en-US,en;q=0.9',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (bxUa) headers['bx-ua'] = bxUa;
      if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

      const url = conversationId
        ? `${BASE_URL}/api/v2/chat/completions?chat_id=${conversationId}`
        : `${BASE_URL}/api/v2/chat/completions`;

      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });

      const actualStatusCode = response.headers.get('x-actual-status-code');
      if (actualStatusCode && actualStatusCode !== '200') {
        const errText = await response.text();
        throw new Error(`Qwen API Error ${actualStatusCode}: ${errText.slice(0, 500)}`);
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Qwen API Error ${response.status}: ${errText.slice(0, 500)}`);
      }

      if (!response.body) throw new Error('No response body');

      let buffer = '';
      let conversationIdCaptured = false;
      let parentIdCaptured = false;
      let capturedParentId: string | null = null;
      const thinkingParser = new StreamingThinkingParser(onContent, onThinking);
      
      for await (const chunk of response.body as any) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // Handle SSE data lines
          let jsonStr = trimmed;
          if (trimmed.startsWith('data: ')) {
            jsonStr = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            jsonStr = trimmed.slice(5).trim();
          } else {
            continue;
          }
          
          if (jsonStr === '[DONE]') {
            thinkingParser.flush();
            onDone();
            return;
          }
          
          try {
            const json = JSON.parse(jsonStr);
            
            // Handle response.created chunk which contains parent_id and response_id
            let responseCreated = null;
            if (json['response.created']) {
              responseCreated = json['response.created'];
            } else if (json.response && json.response.created) {
              responseCreated = json.response.created;
            }
            
            if (responseCreated) {
              // Capture chat_id if this is a new conversation
              if (isNewChat && !conversationIdCaptured && responseCreated.chat_id) {
                conversationIdCaptured = true;
                logger.info(`[Qwen] New conversation created with ID: ${responseCreated.chat_id}`);
                if (onSessionCreated) onSessionCreated(responseCreated.chat_id);
                if (onMetadata) onMetadata({ conversation_id: responseCreated.chat_id });
              }
              
              // CRITICAL: For Qwen, parent_message_id must be the assistant's response_id,
              // NOT the user's parent_id. The response_id is what Qwen expects as parent_id
              // in subsequent requests to maintain conversation context.
              if (!parentIdCaptured && responseCreated.response_id) {
                parentIdCaptured = true;
                capturedParentId = responseCreated.response_id;
                logger.info(`[Qwen] Captured response_id (to use as parent_message_id): ${capturedParentId}`);
                // Cache it server-side so the next turn uses it directly (avoids stale getLastMessageId)
                const chatIdForCache = responseCreated.chat_id || conversationId;
                if (chatIdForCache && capturedParentId) {
                  lastParentIdCache.set(chatIdForCache, capturedParentId);
                }
                // Emit as parent_message_id so client knows what to send next time
                if (onMetadata) onMetadata({ parent_message_id: capturedParentId });
              }
            }
            
            // Extract reasoning_content if delivered in delta fields
            const delta = json.choices?.[0]?.delta;
            if (delta?.reasoning_content && onThinking) {
              onThinking(delta.reasoning_content);
            }

            // Extract content and filter <thinking>...</thinking> blocks
            if (delta?.content) {
              thinkingParser.feed(delta.content);
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }
      }

      thinkingParser.flush();
      
      // If we captured a parent_id and this is a new chat with session created,
      // we should update the conversation's parent_id for future messages
      if (capturedParentId && onMetadata) {
        onMetadata({ last_parent_id: capturedParentId });
      }
      onDone();
    } catch (err: any) {
      onError(err);
    } finally {
      // Always release the lock so the next queued request can proceed
      release();
      // Clean up the lock entry if nothing else is waiting
      // (the entry will be garbage-collected naturally via Promise chain)
    }
  }

  async getModels(credential: string): Promise<any[]> {
    const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
      this.parseCredential(credential);
    const headers: Record<string, string> = {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      cookie: cookieValue,
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
      'user-agent':
        userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'x-request-id': crypto.randomUUID(),
    };
    if (token) headers['authorization'] = `Bearer ${token}`;
    if (bxUa) headers['bx-ua'] = bxUa;
    if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

    // Try fetching from live Qwen endpoints dynamically
    const endpoints = [
      `${BASE_URL}/api/models`,
      `${BASE_URL}/api/v2/models`,
      `${BASE_URL}/api/v1/models`,
    ];

    for (const ep of endpoints) {
      try {
        const response = await fetch(ep, { headers, timeout: 5000 } as any);
        if (response.ok) {
          const json: any = await response.json();
          const items =
            json?.data || json?.models || (Array.isArray(json) ? json : null);
          if (items && Array.isArray(items) && items.length > 0) {
            logger.info(`[Qwen] Fetched ${items.length} live models from ${ep}`);
            return items.map((model: any) => ({
              id: model.id || model.model_id,
              name: model.name || model.label || model.id,
              is_thinking:
                model.info?.meta?.capabilities?.thinking ??
                model.capabilities?.thinking ??
                true,
              max_context_length:
                model.info?.meta?.max_context_length ||
                model.max_context_length ||
                1000000,
              is_search: true,
              is_image_upload:
                model.info?.meta?.capabilities?.multimodal ||
                model.capabilities?.multimodal ||
                false,
            }));
          }
        }
      } catch (e) {
        // try next endpoint
      }
    }

    // Fallback to official up-to-date models matching live browser
    return [
      {
        id: 'qwen-3.8-max',
        name: 'Qwen3.8-Max',
        is_thinking: true,
        max_context_length: 1000000,
        is_search: true,
        is_image_upload: false,
        description:
          'Flagship Qwen3.8 Max with advanced reasoning, coding, and expert-level problem solving',
      },
      {
        id: 'qwen-3.8-plus',
        name: 'Qwen3.8-Plus',
        is_thinking: true,
        max_context_length: 1000000,
        is_search: true,
        is_image_upload: true,
        description:
          'High-performance Qwen3.8 with multimodal visual reasoning and tool use',
      },
      {
        id: 'qwen-3.7-max',
        name: 'Qwen3.7-Max',
        is_thinking: true,
        max_context_length: 1000000,
        is_search: true,
        is_image_upload: false,
        description: 'Flagship Qwen3.7 series reasoning model',
      },
      {
        id: 'qwen-3.7-plus',
        name: 'Qwen3.7-Plus',
        is_thinking: true,
        max_context_length: 1000000,
        is_search: true,
        is_image_upload: true,
        description:
          'Qwen3.7 with state-of-the-art text and multimodal processing',
      },
      {
        id: 'qwen-3.6-plus',
        name: 'Qwen3.6-Plus',
        is_thinking: true,
        max_context_length: 1000000,
        is_search: true,
        is_image_upload: true,
        description: 'Qwen3.6 series multimodal model',
      },
      {
        id: 'qwen-3.5-plus',
        name: 'Qwen3.5-Plus',
        is_thinking: true,
        max_context_length: 1000000,
        is_search: true,
        is_image_upload: true,
        description: 'Qwen3.5 high-efficiency model',
      },
      {
        id: 'qwen-3.5-flash',
        name: 'Qwen3.5-Flash',
        is_thinking: true,
        max_context_length: 1000000,
        is_search: true,
        is_image_upload: true,
        description: 'Qwen3.5 flash high-efficiency model',
      },
      {
        id: 'qwen-max',
        name: 'Qwen-Max',
        is_thinking: true,
        max_context_length: 1000000,
        is_search: true,
        is_image_upload: false,
        description: 'Qwen Max flagship reasoning model',
      },
      {
        id: 'qwen-plus',
        name: 'Qwen-Plus',
        is_thinking: true,
        max_context_length: 1000000,
        is_search: true,
        is_image_upload: true,
        description: 'Qwen Plus versatile model',
      },
    ];
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('qwen') || m.startsWith('qwen-');
  }
}

export default new QwenProvider();
