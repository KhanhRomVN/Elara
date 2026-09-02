import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch, { Response as NodeFetchResponse } from 'node-fetch';
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';
import { loginService } from '../../services/login/login.service';
import { countMessagesTokens } from '../../utils/tokenizer';
import { Provider, SendMessageOptions } from '../../types';

import { PoWChallenge, ChatPayload } from './deepseek.types';
import { DeepSeekHash, BASE_URL, solvePoW } from './deepseek.pow';
import { proxyHandler } from './deepseek.proxy-handler';
import { parseSSEStream } from './deepseek.sse-parser';
import { uploadFile as uploadFileUtil } from './deepseek.upload';
import { preparePromptAndAttachments } from '../../utils/prompt-uploader';

const logger = createLogger('DeepSeekProvider');

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class DeepSeekProvider implements Provider {
  name = 'DeepSeek';
  proxyHandler = proxyHandler;
  defaultModel = 'deepseek-instant';
  private wasmPath: string = '';
  private dsHash: DeepSeekHash | null = null;

  // ===========================================================================
  // PROFILE
  // ===========================================================================

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const url = `${BASE_URL}/api/v0/users/current`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credential}`,
          Origin: BASE_URL,
          Referer: `${BASE_URL}/`,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (response.status === 200 || response.ok) {
        const json = await response.json();
        if (json.code === 0 && json.data) {
          return {
            email: json.data.email || null,
            name: json.data.name,
            id: json.data.id,
          };
        }
      }
      return { email: null };
    } catch (e) {
      logger.error('[DeepSeek] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ===========================================================================
  // LOGIN
  // ===========================================================================

  async login(options?: { deepseekMethod?: 'basic' | 'google' }) {
    const method = options?.deepseekMethod || 'basic';
    const loginUrl =
      method === 'google'
        ? 'https://accounts.google.com/ServiceLogin?service=lso&passive=1209600&continue=https://chat.deepseek.com/login'
        : 'https://chat.deepseek.com/login';

    logger.info(`Starting DeepSeek login with method: ${method}`);

    return await loginService.login({
      providerId: 'deepseek',
      loginUrl,
      partition: `deepseek-${Date.now()}`,
      cookieEvent: 'deepseek-login-token',
      infoEvent: 'deepseek-login-email',
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies) {
          logger.info('[DeepSeek] Validating with captured token');
          const token = data.cookies;
          let email = data.email;

          if (!email) {
            logger.info(
              '[DeepSeek] Email not captured directly, fetching profile...',
            );
            const profile = await this.getProfile(token);
            email = profile.email || undefined;
          }

          if (email) {
            return { isValid: true, cookies: token, email };
          }
        }
        return { isValid: false };
      },
    });
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  constructor() {
    this.initWasm();
  }

  private async initWasm() {
    const execDir = path.dirname(process.execPath);
    const possiblePaths = [
      path.resolve(__dirname, 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      path.join(execDir, 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      path.join(execDir, 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      path.join(process.cwd(), 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      path.join(process.cwd(), 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      path.join(
        process.cwd(),
        'backend',
        'src',
        'provider',
        'sha3_wasm_bg.7b9ca65ddd.wasm',
      ),
      ...(typeof (process as any).resourcesPath !== 'undefined'
        ? [
            path.join(
              (process as any).resourcesPath,
              'resources',
              'sha3_wasm_bg.7b9ca65ddd.wasm',
            ),
            path.join(
              (process as any).resourcesPath,
              'app.asar.unpacked',
              'resources',
              'sha3_wasm_bg.7b9ca65ddd.wasm',
            ),
          ]
        : []),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.wasmPath = p;
        break;
      }
    }

    if (!this.wasmPath) {
      logger.error(
        `DeepSeek WASM not found. Tried paths: ${JSON.stringify(possiblePaths, null, 2)}`,
      );
    }
  }

  async getDsHash(): Promise<DeepSeekHash> {
    if (this.dsHash) return this.dsHash;
    if (!this.wasmPath) await this.initWasm();
    if (!this.wasmPath || !fs.existsSync(this.wasmPath)) {
      throw new Error('DeepSeek WASM file not found');
    }
    this.dsHash = new DeepSeekHash(this.wasmPath);
    await this.dsHash.init();
    return this.dsHash;
  }

  // ===========================================================================
  // CONTINUE INCOMPLETE RESPONSE
  // Calls POST /api/v0/chat/continue to resume a truncated DeepSeek response.
  // ===========================================================================

  private async continueIncompleteResponse(
    client: HttpClient,
    sessionId: string,
    responseMessageId: number,
  ): Promise<NodeFetchResponse> {
    // DeepSeek /chat/continue expects a flat JSON body — NOT wrapped in a "request" field.
    const continuePayload = {
      chat_session_id: sessionId,
      message_id: responseMessageId,
      fallback_to_resume: true,
    };

    logger.info(
      `[DeepSeek] Calling /chat/continue for session=${sessionId} msgId=${responseMessageId} | payload=${JSON.stringify(continuePayload)}`,
    );

    const response = await client.post(
      '/api/v0/chat/continue',
      continuePayload,
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `DeepSeek /chat/continue returned ${response.status}: ${errText}`,
      );
    }

    return response;
  }

  // ===========================================================================
  // HANDLE MESSAGE
  // ===========================================================================

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
      onRaw,
      onSessionCreated,
      accountId,
    } = options;

    const baseHeaders = {
      Cookie: `DS-AUTH-TOKEN=${credential}`,
      Authorization: credential,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      Origin: 'https://chat.deepseek.com',
      Referer: 'https://chat.deepseek.com/',
      'X-App-Version': '2.0.0',
      'X-Client-Version': '2.0.0',
      'X-Client-Platform': 'web',
      'X-Client-Locale': 'en_US',
    };

    const client = new HttpClient({
      baseURL: 'https://chat.deepseek.com',
      headers: baseHeaders,
    });

    // Declare variables outside try-catch so they're accessible in catch block
    let sessionId: string | undefined = options.conversationId;
    
    // DeepSeek API strictly requires chat_session_id to be a valid UUID v4
    const isUUID = (str?: string) =>
      str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false;

    if (sessionId && !isUUID(sessionId)) {
      logger.warn(
        `[DeepSeek] Provided conversationId '${sessionId}' is not a valid UUID. Resetting to create a fresh session.`,
      );
      sessionId = undefined;
    }

    let currentModel = model;

    try {
      // Determine if sessionId exists on DeepSeek server
      let needsNewSession = !sessionId;

      if (sessionId && messages.length > 1) {
        const lastMsgId = await this.getLastMessageId(client, sessionId);
        if (lastMsgId === null) {
          logger.info(
            `[DeepSeek] Session '${sessionId}' not found on DeepSeek server. Creating fresh session.`,
          );
          needsNewSession = true;
        }
      } else {
        // First user message in conversation requires a real DeepSeek server session
        needsNewSession = true;
      }

      if (needsNewSession) {
        const sessionRes = await client.post('/api/v0/chat_session/create', {
          character_id: null,
        });
        if (!sessionRes.ok) {
          const errText = await sessionRes.text();
          throw new Error(
            `Failed to create chat session: ${sessionRes.status} - ${errText}`,
          );
        }
        const sessionData = await sessionRes.json();
        sessionId =
          sessionData?.data?.biz_data?.chat_session?.id ||
          sessionData?.data?.biz_data?.id;
        if (!sessionId) {
          throw new Error(
            `Session ID missing from response: ${JSON.stringify(sessionData)}`,
          );
        }
        logger.info(`[DeepSeek] Successfully created new server chat session: ${sessionId}`);
      }

      if (!sessionId) throw new Error('Failed to obtain session ID');
      currentModel = model;

      if (onSessionCreated) onSessionCreated(sessionId);
      if (onMetadata) {
        onMetadata({
          conversation_id: sessionId,
          conversation_title: 'New Chat',
        });
      }

      let parentMessageId: string | null | undefined = undefined;
      if (options.parent_message_id) {
        parentMessageId = options.parent_message_id;
      } else if (options.conversationId) {
        parentMessageId = await this.getLastMessageId(client, sessionId);
      }

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = crypto.randomBytes(8).toString('hex');
      const clientStreamId = `${date}-${randomPart}`;

      // Run Chat PoW challenge solving and large payload auto-upload in parallel to eliminate sequential lag
      const [powResponseBase64, { promptText, refFileIds }] = await Promise.all([
        this.solveChatPoW(baseHeaders, sessionId),
        preparePromptAndAttachments({
          providerId: 'deepseek',
          messages,
          refFileIds: options.ref_file_ids,
          uploadFn: (file) => this.uploadFile(credential, file),
        }),
      ]);

      const requestPayload: ChatPayload = {
        chat_session_id: sessionId,
        parent_message_id: parentMessageId || null || undefined,
        prompt: promptText,
        messages: [],
        ref_file_ids: refFileIds,
        thinking_enabled: options.thinking ?? model === 'deepseek-reasoner',
        search_enabled: options.search || false,
        client_stream_id: clientStreamId,
        model_type: model === 'deepseek-expert' ? 'expert' : 'default',
      };

      const completionClient = new HttpClient({
        baseURL: 'https://chat.deepseek.com',
        headers: {
          ...baseHeaders,
          Referer: `https://chat.deepseek.com/a/chat/s/${sessionId}`,
          'X-Ds-Pow-Response': powResponseBase64,
        },
      });

      const response = await completionClient.post(
        '/api/v0/chat/completion',
        requestPayload,
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API returned ${response.status}: ${errorText}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Shared mutable state across initial + continuation streams
      const promptTokens = countMessagesTokens(messages);
      const completionTokensRef = { value: 0 };
      const currentModeRef: { value: 'THINK' | 'RESPONSE' } = {
        value: 'RESPONSE',
      };

      // Client for continue calls (uses session-scoped Referer)
      const continueClient = new HttpClient({
        baseURL: 'https://chat.deepseek.com',
        headers: {
          ...baseHeaders,
          Referer: `https://chat.deepseek.com/a/chat/s/${sessionId}`,
        },
      });

      // ── Parse initial stream ────────────────────────────────────────────
      let { incomplete, responseMessageId, accumulatedContent } =
        await parseSSEStream(response.body as NodeJS.ReadableStream, {
          onContent,
          onThinking,
          onMetadata,
          onRaw,
          sessionId,
          promptTokens,
          completionTokensRef,
          currentModeRef,
        });

      // ── Auto-continue loop ──────────────────────────────────────────────
      // DeepSeek may truncate long responses. We keep calling /chat/continue
      // until the response is complete (quasi_status !== INCOMPLETE).
      const MAX_CONTINUATIONS = 10; // safety cap to prevent infinite loops
      let continuationCount = 0;

      while (
        incomplete &&
        responseMessageId !== null &&
        continuationCount < MAX_CONTINUATIONS
      ) {
        continuationCount++;
        logger.info(
          `[DeepSeek] Auto-continue attempt ${continuationCount}/${MAX_CONTINUATIONS} | session=${sessionId} | msgId=${responseMessageId}`,
        );

        if (onMetadata) {
          onMetadata({
            continuing: true,
            continuation_count: continuationCount,
          });
        }

        let continueResponse: NodeFetchResponse;
        try {
          continueResponse = await this.continueIncompleteResponse(
            continueClient,
            sessionId,
            responseMessageId,
          );
        } catch (continueErr: any) {
          logger.error(
            `[DeepSeek] /chat/continue failed: ${continueErr.message}`,
          );
          // Don't propagate — treat as end of stream with what we have
          break;
        }

        if (!continueResponse.body) {
          logger.warn(
            '[DeepSeek] /chat/continue returned no body, stopping continuation',
          );
          break;
        }

        const continueResult = await parseSSEStream(
          continueResponse.body as unknown as NodeJS.ReadableStream,
          {
            onContent,
            onThinking,
            onMetadata,
            onRaw,
            sessionId,
            promptTokens,
            completionTokensRef,
            currentModeRef,
            // Tell the parser how many chars are already accumulated so it can
            // skip the snapshot prefix that DeepSeek replays from /chat/continue.
            priorContentLength: accumulatedContent.length,
          },
        );

        // Merge accumulated content across continuations
        accumulatedContent += continueResult.accumulatedContent;

        incomplete = continueResult.incomplete;
        // Update responseMessageId if the continuation stream provides a new one
        if (continueResult.responseMessageId !== null) {
          responseMessageId = continueResult.responseMessageId;
        }
        logger.info(
          `[DeepSeek] Auto-continue attempt ${continuationCount} result | incomplete=${continueResult.incomplete} | newMsgId=${continueResult.responseMessageId ?? 'unchanged'} | session=${sessionId}`,
        );
      }

      if (continuationCount >= MAX_CONTINUATIONS && incomplete) {
        logger.warn(
          `[DeepSeek] Max continuations reached | session=${sessionId} | totalAttempts=${continuationCount}`,
        );
      }

      // Signal that all continuations are done — Zen uses this to know the merged response is complete
      if (continuationCount > 0 && onMetadata) {
        onMetadata({
          continuing: false,
          continuation_complete: true,
          total_continuations: continuationCount,
        });
      }

      onDone();
    } catch (err: any) {
      // Log full error details for debugging
      logger.error('[DeepSeek] handleMessage error:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        status: err.status,
        response: err.response,
        sessionId: sessionId || 'unknown',
        model: currentModel || 'unknown',
      });
      onError(err);
    }
  }

  // ===========================================================================
  // POW SOLVER
  // ===========================================================================

  private async solveChatPoW(baseHeaders: any, sessionId: string): Promise<string> {
    try {
      const challengeClient = new HttpClient({
        baseURL: 'https://chat.deepseek.com',
        headers: {
          ...baseHeaders,
          Referer: `https://chat.deepseek.com/a/chat/s/${sessionId}`,
        },
      });

      const challengeRes = await challengeClient.post(
        '/api/v0/chat/create_pow_challenge',
        { target_path: '/api/v0/chat/completion' },
      );

      if (challengeRes.ok) {
        const rawText = await challengeRes.text();
        const challengeJson = JSON.parse(rawText);
        const challengeData: PoWChallenge =
          challengeJson?.data?.biz_data?.challenge;
        if (challengeData) {
          const dsHash = await this.getDsHash();
          const powAnswer = await solvePoW(dsHash, challengeData);
          return Buffer.from(JSON.stringify(powAnswer)).toString('base64');
        } else {
          logger.warn(
            `[DeepSeek] PoW challenge data missing from response | session=${sessionId} | body=${rawText.slice(0, 200)}`,
          );
        }
      } else {
        const errText = await challengeRes.text().catch(() => '<unreadable>');
        logger.warn(
          `[DeepSeek] PoW challenge request failed | status=${challengeRes.status} | session=${sessionId} | body=${errText.slice(0, 200)}`,
        );
      }
    } catch (e) {
      logger.warn(
        `[DeepSeek] Failed to parse PoW challenge response | session=${sessionId} | error=${e}`,
      );
    }
    return '';
  }

  // ===========================================================================
  // HISTORY
  // ===========================================================================

  private async getLastMessageId(
    client: HttpClient,
    sessionId: string,
  ): Promise<string | null> {
    try {
      const res = await client.get(
        `/api/v0/chat/history_messages?chat_session_id=${sessionId}&count=20`,
      );
      if (res.ok) {
        const data = await res.json();
        const messages = data?.data?.biz_data?.chat_messages || [];
        const lastAssistant = [...messages]
          .reverse()
          .find((m: any) => m.role && m.role.toUpperCase() === 'ASSISTANT');
        return lastAssistant?.message_id || null;
      }
    } catch (e) {}
    return null;
  }

  // ===========================================================================
  // STOP STREAM
  // ===========================================================================

  async stopStream(credential: string, chatId: string, messageId: string) {
    const client = this.createClient(credential);
    await client.post('/api/v0/chat/stop_generation', {
      chat_session_id: chatId,
      current_message_id: messageId,
    });
  }

  // ===========================================================================
  // FILE UPLOAD
  // ===========================================================================

  async uploadFile(
    credential: string,
    file: any,
  ): Promise<{ id: string; token_usage: number }> {
    return uploadFileUtil(credential, file, () => this.getDsHash());
  }

  // ===========================================================================
  // HTTP CLIENT
  // ===========================================================================

  private createClient(credential: string) {
    return new HttpClient({
      baseURL: 'https://chat.deepseek.com',
      headers: {
        Cookie: `DS-AUTH-TOKEN=${credential}`,
        Authorization: credential,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
  }

  // ===========================================================================
  // ROUTES
  // ===========================================================================

  registerRoutes(router: Router) {
    router.post('/files', async (req, res) => {
      res.json({ id: 'mock-id-uploaded' });
    });
  }

  // ===========================================================================
  // MODEL SUPPORT
  // ===========================================================================

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return (
      m.includes('deepseek-chat') ||
      m.includes('deepseek-reasoner') ||
      m.includes('deepseek-instant') ||
      m.includes('deepseek-expert')
    );
  }
}

export default new DeepSeekProvider();
