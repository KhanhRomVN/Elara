import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import { HttpClient } from '../../utils/http-client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { findAccount } from '../../services/account-selector';
import { createLogger } from '../../utils/logger';
import { ChatPayload, PoWChallenge, PoWResponse } from './types';
import { DeepSeekHash } from './hash';
import { countTokens, countMessagesTokens } from '../../utils/tokenizer';

const logger = createLogger('DeepSeekProvider');

export class DeepSeekProvider implements Provider {
  name = 'DeepSeek';
  defaultModel = 'deepseek-chat';
  private wasmPath: string = '';
  private dsHash: DeepSeekHash | null = null;

  constructor() {
    this.initWasm();
  }

  private async initWasm() {
    // Find WASM path logic
    const possiblePaths = [
      path.resolve(__dirname, 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      path.join(process.cwd(), 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      path.join(
        process.cwd(),
        'backend',
        'src',
        'provider',
        'deepseek',
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
        logger.info(`DeepSeek WASM found at: ${p}`);
        break;
      }
    }

    if (!this.wasmPath) {
      logger.error(
        `DeepSeek WASM not found. Tried paths: ${JSON.stringify(possiblePaths, null, 2)}`,
      );
    }
  }

  private async getDsHash(): Promise<DeepSeekHash> {
    if (this.dsHash) return this.dsHash;
    if (!this.wasmPath) await this.initWasm();
    if (!this.wasmPath || !fs.existsSync(this.wasmPath)) {
      throw new Error('DeepSeek WASM file not found');
    }
    this.dsHash = new DeepSeekHash(this.wasmPath);
    await this.dsHash.init();
    return this.dsHash;
  }

  private async solvePoW(challenge: PoWChallenge): Promise<PoWResponse> {
    const dsHash = await this.getDsHash();
    const prefix = `${challenge.salt}_${challenge.expire_at}_`;
    const answer = dsHash.calculateHash(
      challenge.difficulty,
      challenge.challenge,
      prefix,
    );

    return {
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      salt: challenge.salt,
      answer: answer !== null ? answer : 0,
      signature: challenge.signature,
      target_path: challenge.target_path,
    };
  }

  // --- Chat Logic ---

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      stream,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
      onSessionCreated,
    } = options;
    const baseHeaders = {
      Cookie: `DS-AUTH-TOKEN=${credential}`,
      Authorization: credential,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Origin: 'https://chat.deepseek.com',
      Referer: 'https://chat.deepseek.com/',
    };

    const client = new HttpClient({
      baseURL: 'https://chat.deepseek.com',
      headers: baseHeaders,
    });

    try {
      // 1. Create/Get Chat Session
      let sessionId = options.conversationId;
      if (!sessionId) {
        const sessionRes = await client.post('/api/v0/chat_session/create', {
          character_id: null,
        });
        if (!sessionRes.ok)
          throw new Error(
            `Failed to create chat session: ${sessionRes.status}`,
          );
        const sessionData = await sessionRes.json();
        sessionId = sessionData?.data?.biz_data?.id;
      }

      if (!sessionId) throw new Error('Failed to obtain session ID');

      if (onSessionCreated) onSessionCreated(sessionId);
      if (onMetadata) {
        onMetadata({
          conversation_id: sessionId,
          conversation_title: 'New Chat',
        });
      }

      // Auto-fetch parent_message_id
      let parentMessageId: string | null | undefined = undefined;
      // Actually, we should fetch parent_message_id if conservation_id exists
      if (options.conversationId) {
        parentMessageId = await this.getLastMessageId(client, sessionId);
      }

      // 2. Request PoW
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
      let powResponseBase64 = '';
      if (challengeRes.ok) {
        const challengeJson = await challengeRes.json();
        const challengeData: PoWChallenge =
          challengeJson?.data?.biz_data?.challenge;
        if (challengeData) {
          const powAnswer = await this.solvePoW(challengeData);
          powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
            'base64',
          );
        }
      }

      // 3. Prepare Payload
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = crypto.randomBytes(8).toString('hex');
      const clientStreamId = `${date}-${randomPart}`;

      const requestPayload: ChatPayload = {
        chat_session_id: sessionId,
        parent_message_id: parentMessageId || null || undefined,
        prompt: messages[messages.length - 1].content,
        messages: [], // Required by interface match but logic uses prompt? Oh wait, interface I made has messages.
        // Original requestPayload didn't have messages, it had prompt.
        // Let's check original code. Original code had `prompt: messages[messages.length - 1].content`.
        // My interface `ChatPayload` has `messages`. Let's correct `requestPayload` to match what API expects, or update Interface.
        // API expects `prompt`.
        ref_file_ids: options.ref_file_ids || [],
        thinking_enabled: options.thinking ?? model === 'deepseek-reasoner',
        search_enabled: options.search || false,
        client_stream_id: clientStreamId,
      };

      // 4. Send Request
      const completionClient = new HttpClient({
        baseURL: 'https://chat.deepseek.com',
        headers: {
          ...baseHeaders,
          Referer: `https://chat.deepseek.com/a/chat/s/${sessionId}`,
          'X-Ds-Pow-Response': powResponseBase64,
          'X-App-Version': '20241129.1',
          'X-Client-Locale': 'en_US',
          'X-Client-Platform': 'web',
          'X-Client-Version': '1.0.0-always',
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

      // 5. Stream processing
      if (!response.body) {
        throw new Error('No response body');
      }

      let buffer = '';
      let currentMode: 'THINK' | 'RESPONSE' = 'RESPONSE';
      const promptTokens = countMessagesTokens(messages);
      let completionTokens = 0;

      for await (const chunk of response.body) {
        const chunkStr = chunk.toString();
        if (onRaw) onRaw(chunkStr);
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();
            if (jsonStr === '[DONE]') {
              onDone();
              return;
            }

            try {
              const json = JSON.parse(jsonStr);

              // Skip message ID metadata
              if (
                json.request_message_id !== undefined &&
                json.response_message_id !== undefined
              ) {
                continue;
              }

              // 1. Handle standard OpenAI-like format
              if (json.choices?.[0]?.delta?.content) {
                const deltaText = json.choices[0].delta.content;
                completionTokens += countTokens(deltaText);
                onContent(deltaText);
                if (onMetadata) {
                  onMetadata({ total_token: promptTokens + completionTokens });
                }
                continue;
              }

              // 2. Handle DeepSeek path-based format
              const path = json.p;
              const value = json.v;

              if (Array.isArray(value)) {
                // Handle fragment arrays
                const fragment = value[0];
                if (fragment) {
                  if (fragment.type === 'THINK') {
                    currentMode = 'THINK';
                    if (fragment.content) {
                      if (onThinking) onThinking(fragment.content);
                      else onContent(`[Thinking] ${fragment.content}\n`);
                    }
                  } else if (fragment.type === 'RESPONSE') {
                    currentMode = 'RESPONSE';
                    if (fragment.content) {
                      completionTokens += countTokens(fragment.content);
                      onContent(fragment.content);
                      if (onMetadata) {
                        onMetadata({
                          total_token: promptTokens + completionTokens,
                        });
                      }
                    }
                  }
                }
              } else if (typeof value === 'string') {
                if (path?.includes('thinking_content')) {
                  currentMode = 'THINK';
                  completionTokens += countTokens(value);
                  if (onThinking) onThinking(value);
                  else onContent(`[Thinking] ${value}\n`);
                  if (onMetadata) {
                    onMetadata({
                      total_token: promptTokens + completionTokens,
                    });
                  }
                } else if (
                  path === 'response/content' ||
                  path?.endsWith('/content')
                ) {
                  if (path === 'response/content') {
                    currentMode = 'RESPONSE';
                  }

                  if (currentMode === 'THINK') {
                    completionTokens += countTokens(value);
                    if (onThinking) onThinking(value);
                    else onContent(`[Thinking] ${value}\n`);
                  } else {
                    completionTokens += countTokens(value);
                    onContent(value);
                  }

                  if (onMetadata) {
                    onMetadata({
                      total_token: promptTokens + completionTokens,
                    });
                  }
                } else if (!path) {
                  // Fallback based on currentMode
                  completionTokens += countTokens(value);
                  if (currentMode === 'THINK') {
                    if (onThinking) onThinking(value);
                    else onContent(`[Thinking] ${value}\n`);
                  } else {
                    onContent(value);
                  }
                  if (onMetadata) {
                    onMetadata({
                      total_token: promptTokens + completionTokens,
                    });
                  }
                }
              } else if (
                path?.endsWith('/elapsed_secs') ||
                path?.endsWith('thinking_elapsed_secs')
              ) {
                if (onMetadata) {
                  onMetadata({ thinking_elapsed: value });
                }
              }
            } catch (e) {}
          }
        }
      }
      // If it was a new session, try to fetch/generate title
      if (!options.conversationId && sessionId) {
        try {
          // Try Auto-Rename to generate a title
          const renameRes = await client.post(
            '/api/v0/chat_session/auto_rename',
            {
              chat_session_id: sessionId,
            },
          );

          if (renameRes.ok) {
            const renameData = await renameRes.json();
            const title = renameData?.data?.biz_data?.title;
            if (title && onMetadata) {
              onMetadata({ conversation_title: title });
            }
          }
        } catch (e) {
          logger.warn('Failed to auto-rename session:', e);
        }
      }

      onDone();
    } catch (err: any) {
      onError(err);
    }
  }

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

  // --- Extra Methods for Routes ---
  async getConversations(
    credential: string,
    limit: number = 30,
  ): Promise<any[]> {
    try {
      const client = this.createClient(credential);
      const sessions = await client.get(
        `/api/v0/chat_session/fetch_page?lte_cursor.pinned=false&count=${limit}`,
      );
      const data = await sessions.json();
      return data?.data?.biz_data?.chat_sessions || [];
    } catch (e) {
      return [];
    }
  }

  async getConversationDetail(
    credential: string,
    sessionId: string,
  ): Promise<any> {
    const client = this.createClient(credential);
    const res = await client.get(
      `/api/v0/chat/history_messages?chat_session_id=${sessionId}`,
    );
    const data = await res.json();

    // Normalize DeepSeek data
    if (
      data.code === 0 &&
      data.data &&
      data.data.biz_data &&
      data.data.biz_data.chat_messages
    ) {
      const messages = data.data.biz_data.chat_messages.map((msg: any) => ({
        id: msg.message_id,
        role: msg.role === 'USER' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.created_at || Date.now() / 1000,
      }));

      const meta = data.data.biz_data.chat_session || {};

      const total_token = countMessagesTokens(messages);

      return {
        conversation_id: meta.id,
        conversation_title: meta.title,
        updated_at: meta.updated_at || Date.now() / 1000,
        total_token,
        messages,
      };
    }

    return { messages: data };
  }

  async stopStream(credential: string, chatId: string, messageId: string) {
    const client = this.createClient(credential);
    await client.post('/api/v0/chat/stop_generation', {
      chat_session_id: chatId,
      current_message_id: messageId,
    });
  }

  async uploadFile(credential: string, file: any) {
    const baseHeaders = {
      Cookie: `DS-AUTH-TOKEN=${credential}`,
      Authorization: credential,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Origin: 'https://chat.deepseek.com',
      Referer: 'https://chat.deepseek.com/',
    };

    const client = this.createClient(credential);

    try {
      // 1. Request PoW Challenge
      const challengeRes = await client.post(
        '/api/v0/chat/create_pow_challenge',
        { target_path: '/api/v0/file/upload_file' },
      );

      let powResponseBase64 = '';
      if (challengeRes.ok) {
        const challengeJson = await challengeRes.json();
        const challengeData = challengeJson?.data?.biz_data?.challenge;

        if (challengeData) {
          logger.info('[DeepSeek Upload] Solving PoW...');
          const powAnswer = await this.solvePoW(challengeData);
          powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
            'base64',
          );
        }
      } else {
        logger.warn(
          '[DeepSeek Upload] Failed to get PoW challenge, proceeding without it.',
        );
      }

      // 2. Construct Multipart Payload
      const boundary =
        '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
      const crlf = '\r\n';

      const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${file.originalname}"${crlf}Content-Type: ${file.mimetype}${crlf}${crlf}`;
      const footer = `${crlf}--${boundary}--${crlf}`;

      const payloadBuffer = Buffer.concat([
        Buffer.from(header),
        file.buffer,
        Buffer.from(footer),
      ]);

      // 3. Send Request
      const headers: any = {
        ...baseHeaders,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'x-client-locale': 'en_US',
        'x-app-version': '20241129.1',
        'x-client-version': '1.6.1',
        'x-client-platform': 'web',
        'x-file-size': file.buffer.length.toString(),
      };

      if (powResponseBase64) {
        headers['X-Ds-Pow-Response'] = powResponseBase64;
      }

      const uploadRes = await fetch(
        'https://chat.deepseek.com/api/v0/file/upload_file',
        {
          method: 'POST',
          headers,
          body: payloadBuffer,
        },
      );

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(
          `DeepSeek Upload Failed ${uploadRes.status}: ${errorText}`,
        );
      }

      const result: any = await uploadRes.json();
      logger.info('[DeepSeek Upload] Result:', JSON.stringify(result, null, 2));

      if (result.code === 0 && result.data?.biz_data?.id) {
        const fileId = result.data.biz_data.id;

        // Polling for status
        logger.info(`[DeepSeek Upload] Polling status for ${fileId}...`);
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          try {
            const listRes = await client.get(
              `/api/v0/file/fetch_files?file_ids=${fileId}`,
            );
            if (listRes.ok) {
              const listData = await listRes.json();
              const files = listData?.data?.biz_data?.files || [];
              const targetFile = files.find((f: any) => f.id === fileId);

              if (targetFile) {
                logger.info(
                  `[DeepSeek Upload] File Status: ${targetFile.status}`,
                );
                if (
                  targetFile.status === 'SUCCESS' ||
                  targetFile.status === 'READY'
                ) {
                  return {
                    id: fileId,
                    token_usage: targetFile.token_usage || 0,
                  };
                }
                if (
                  targetFile.status === 'FAIL' ||
                  targetFile.status === 'ERROR'
                ) {
                  throw new Error(
                    `File processing failed: ${targetFile.status}`,
                  );
                }
              }
            }
          } catch (e) {
            logger.warn('[DeepSeek Upload] Polling check failed', e);
          }
          attempts++;
        }
        logger.warn(
          '[DeepSeek Upload] Timed out waiting for file status, proceeding...',
        );
        return { id: fileId, token_usage: 0 };
      } else {
        throw new Error(`Upload failed: ${result.msg || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('[DeepSeek Upload] Error:', error);
      throw error;
    }
  }

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

  registerRoutes(router: Router) {
    router.get('/sessions', async (req, res) => {
      try {
        const account = findAccount(req, 'DeepSeek');
        if (!account) return res.status(401).json({ error: 'No account' });
        const sessions = await this.getConversations(account.credential, 30);
        res.json(sessions);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    router.get('/sessions/:id/messages', async (req, res) => {
      try {
        const account = findAccount(req, 'DeepSeek');
        if (!account) return res.status(401).json({ error: 'No account' });
        const hist = await this.getConversationDetail(
          account.credential,
          req.params.id,
        );
        res.json(hist);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    router.post('/files', async (req, res) => {
      // File upload route...
      res.json({ id: 'mock-id-uploaded' });
    });
  }
}
