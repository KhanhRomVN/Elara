import { HttpClient } from '../../utils/http-client';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// PoW Types
interface PoWChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  difficulty: number;
  signature: string;
  expire_at: number;
  target_path: string;
}

interface PoWResponse {
  algorithm: string;
  challenge: string;
  salt: string;
  answer: number;
  signature: string;
  target_path: string;
}

class DeepSeekHash {
  private instance: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private wasmPath: string;

  constructor(wasmPath: string) {
    this.wasmPath = wasmPath;
  }

  async init() {
    if (this.instance) return;

    try {
      if (!fs.existsSync(this.wasmPath)) {
        throw new Error(`WASM file not found at ${this.wasmPath}`);
      }
      const wasmBuffer = fs.readFileSync(this.wasmPath);
      const wasmModule = new WebAssembly.Module(wasmBuffer);

      const instance = new WebAssembly.Instance(wasmModule, {
        wasi_snapshot_preview1: {
          fd_write: () => 0,
          environ_sizes_get: () => 0,
          environ_get: () => 0,
          clock_time_get: () => 0,
          fd_close: () => 0,
          fd_seek: () => 0,
          fd_fdstat_get: () => 0,
          proc_exit: () => 0,
        },
        env: {},
      });

      this.instance = instance;
      this.memory = instance.exports.memory as WebAssembly.Memory;
    } catch (e) {
      console.error('Failed to load WASM:', e);
      throw e;
    }
  }

  private writeToMemory(text: string): [number, number] {
    if (!this.instance || !this.memory) throw new Error('WASM not initialized');

    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    const length = encoded.length;

    // Allocate memory using __wbindgen_export_0 (malloc)
    const malloc = this.instance.exports
      .__wbindgen_export_0 as CallableFunction;
    const ptr = malloc(length, 1) as number;

    const memoryView = new Uint8Array(this.memory.buffer);
    memoryView.set(encoded, ptr);

    return [ptr, length];
  }

  // Calculate Hash
  calculateHash(
    difficulty: number,
    challenge: string,
    prefix: string,
  ): number | null {
    if (!this.instance || !this.memory) throw new Error('WASM not initialized');

    const stackPointerFn = this.instance.exports
      .__wbindgen_add_to_stack_pointer as CallableFunction;
    const solveFn = this.instance.exports.wasm_solve as CallableFunction;

    const retptr = stackPointerFn(-16) as number;

    try {
      const [challengePtr, challengeLen] = this.writeToMemory(challenge);
      const [prefixPtr, prefixLen] = this.writeToMemory(prefix);

      // wasm_solve(retptr, challenge_ptr, challenge_len, prefix_ptr, prefix_len, difficulty)
      solveFn(
        retptr,
        challengePtr,
        challengeLen,
        prefixPtr,
        prefixLen,
        difficulty,
      );

      const memoryView = new DataView(this.memory.buffer);

      // Read status (i32) at retptr
      const status = memoryView.getInt32(retptr, true); // little-endian

      if (status === 0) {
        return null;
      }

      // Read result (f64) at retptr + 8
      const value = memoryView.getFloat64(retptr + 8, true); // little-endian
      return Number(value); // Convert to number (integer likely)
    } finally {
      stackPointerFn(16);
    }
  }
}

// Global instance
let dsHash: DeepSeekHash | null = null;

// Solves the PoW challenge using WASM
async function solvePoW(challenge: PoWChallenge): Promise<PoWResponse> {
  if (!dsHash) {
    const possiblePaths = [
      // 1. Relative path for source (backend/src/services/chat -> ../../utils)
      path.resolve(__dirname, '../../utils/sha3_wasm_bg.7b9ca65ddd.wasm'),
      // 2. Dev environment (project root -> backend/src/utils)
      path.resolve(
        process.cwd(),
        'backend/src/utils/sha3_wasm_bg.7b9ca65ddd.wasm',
      ),
      // 3. Project root resources folder
      path.resolve(process.cwd(), 'resources/sha3_wasm_bg.7b9ca65ddd.wasm'),
      // 4. Production environment (if process.resourcesPath is available)
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

    let wasmPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        wasmPath = p;
        console.log('[DeepSeek PoW] Found WASM at:', wasmPath);
        break;
      }
    }

    if (!wasmPath) {
      console.error(
        '[DeepSeek PoW] WASM file not found. Tried paths:',
        possiblePaths,
      );
      console.error('[DeepSeek PoW] process.cwd():', process.cwd());
      console.error('[DeepSeek PoW] __dirname:', __dirname);
      throw new Error('WASM file not found for DeepSeek PoW');
    }

    dsHash = new DeepSeekHash(wasmPath);
    await dsHash.init();
  }

  // Format: salt_expireAt_
  const prefix = `${challenge.salt}_${challenge.expire_at}_`;

  const answer = dsHash!.calculateHash(
    challenge.difficulty,
    challenge.challenge,
    prefix,
  );

  if (answer !== null) {
    return {
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      salt: challenge.salt,
      answer: answer,
      signature: challenge.signature,
      target_path: challenge.target_path,
    };
  } else {
    console.error('[PoW] Failed to find solution.');
    return {
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      salt: challenge.salt,
      answer: 0,
      signature: challenge.signature,
      target_path: challenge.target_path,
    };
  }
}

// Login is handled in main process, not backend

/**
 * Helper function to fetch the last assistant message ID from a conversation
 * This allows the backend to automatically determine parent_message_id
 */
async function getLastMessageId(
  client: HttpClient,
  sessionId: string,
): Promise<number | null> {
  try {
    console.log('[DeepSeek] Fetching messages for session:', sessionId);
    const res = await client.get(
      `/api/v0/chat/history_messages?chat_session_id=${sessionId}&count=20`,
    );

    if (res.ok) {
      const data = await res.json();
      console.log(
        '[DeepSeek] Messages API response:',
        JSON.stringify(data, null, 2),
      );

      const messages = data?.data?.biz_data?.chat_messages || [];
      console.log('[DeepSeek] Found', messages.length, 'messages');

      // Debug: Log roles of last few messages
      if (messages.length > 0) {
        console.log(
          '[DeepSeek] Last message roles:',
          messages.slice(-3).map((m: any) => m.role),
        );
      }

      // Find the last assistant message (case-insensitive)
      const lastAssistant = [...messages]
        .reverse()
        .find((m: any) => m.role && m.role.toUpperCase() === 'ASSISTANT');

      if (lastAssistant?.message_id) {
        console.log(
          '[DeepSeek] Auto-fetched parent_message_id:',
          lastAssistant.message_id,
        );
        return lastAssistant.message_id;
      } else {
        console.warn('[DeepSeek] No assistant message found in conversation');
      }
    } else {
      console.error('[DeepSeek] Failed to fetch messages, status:', res.status);
    }
  } catch (e) {
    console.warn('[DeepSeek] Failed to auto-fetch parent_message_id:', e);
  }
  return null;
}

export interface ChatPayload {
  model?: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  search?: boolean;
  conversation_id?: string;
  ref_file_ids?: string[];
  thinking?: boolean;
  parent_message_id?: string;
}

export interface Account {
  id: string;
  email: string;
  provider: string;
  credential: string;
  status: string;
  userAgent?: string;
}

export async function chatCompletionStream(
  token: string,
  payload: ChatPayload,
  userAgent: string | undefined,
  callbacks: {
    onContent: (content: string) => void;
    onThinking?: (content: string) => void;
    onMetadata?: (metadata: any) => void;
    onRaw?: (data: string) => void;
    onSessionCreated?: (sessionId: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  const baseHeaders = {
    Cookie: `DS-AUTH-TOKEN=${token}`,
    Authorization: token,
    'Content-Type': 'application/json',
    'User-Agent':
      userAgent ||
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
    let sessionId = payload.conversation_id;
    if (!sessionId) {
      const sessionRes = await client.post('/api/v0/chat_session/create', {
        character_id: null,
      });

      if (!sessionRes.ok) {
        const errorText = await sessionRes.text();
        console.error(
          '[DeepSeek] Session creation failed:',
          sessionRes.status,
          errorText,
        );
        throw new Error(`Failed to create chat session: ${sessionRes.status}`);
      }
      const sessionData = await sessionRes.json();
      console.log(
        '[DeepSeek] Session Response:',
        JSON.stringify(sessionData, null, 2),
      );
      sessionId = sessionData?.data?.biz_data?.id;
    }

    if (!sessionId) {
      console.error('[DeepSeek] No session ID in response');
      throw new Error('Failed to obtain session ID');
    }

    if (callbacks.onSessionCreated) {
      callbacks.onSessionCreated(sessionId);
    }

    // Auto-fetch parent_message_id
    let parentMessageId: number | undefined | null = undefined;
    if (payload.conversation_id) {
      console.log('[DeepSeek] Auto-fetching parent_message_id...');
      const fetchedId = await getLastMessageId(client, sessionId);
      parentMessageId = fetchedId;
    }

    // 2. Request PoW Challenge
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
        console.log('[DeepSeek] Solving PoW...');
        const powAnswer = await solvePoW(challengeData);
        powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
          'base64',
        );
        console.log('[DeepSeek] PoW Solved');
      }
    } else {
      console.warn(
        '[DeepSeek] Failed to get PoW challenge, proceeding without it.',
      );
    }

    // Generate client_stream_id
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = crypto.randomBytes(8).toString('hex');
    const clientStreamId = `${date}-${randomPart}`;

    const requestPayload: any = {
      chat_session_id: sessionId,
      parent_message_id: payload.parent_message_id || parentMessageId || null,
      prompt: payload.messages[payload.messages.length - 1].content,
      ref_file_ids: payload.ref_file_ids || [],
      thinking_enabled:
        payload.thinking ?? payload.model === 'deepseek-reasoner',
      search_enabled: payload.search || false,
      client_stream_id: clientStreamId,
    };

    console.log('[DeepSeek] Thinking param:', payload.thinking);

    console.log(
      '[DeepSeek] Request Payload:',
      JSON.stringify(requestPayload, null, 2),
    );

    // 3. Send Completion Request with PoW Header
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

    console.log('[DeepSeek] Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DeepSeek] API Error:', response.status, errorText);
      callbacks.onError(
        new Error(`DeepSeek API returned ${response.status}: ${errorText}`),
      );
      return;
    }

    if (!response.body) {
      callbacks.onError(new Error('No response body'));
      return;
    }

    // Process SSE stream
    let buffer = '';
    let currentMode: 'THINK' | 'RESPONSE' = 'RESPONSE';

    for await (const chunk of response.body) {
      const chunkStr = chunk.toString();
      // console.log('[DeepSeek] Chunk:', chunkStr);
      buffer += chunkStr;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          continue;
        }

        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();
          if (jsonStr === '[DONE]') {
            callbacks.onDone();
            return;
          }

          try {
            const json = JSON.parse(jsonStr);

            // Skip message ID metadata - not needed for client
            if (
              json.request_message_id !== undefined &&
              json.response_message_id !== undefined
            ) {
              continue;
            }

            // 1. Handle standard OpenAI-like format (if exists)
            if (json.choices?.[0]?.delta?.content) {
              callbacks.onContent(json.choices[0].delta.content);
              continue;
            }

            // 2. Handle DeepSeek 'v' format (e.g. {"v": "..."} or {"p": "...", "v": "..."})
            if (typeof json.v === 'string') {
              const path = json.p;
              const value = json.v;

              if (path?.includes('thinking_content')) {
                // Explicit thinking content path
                currentMode = 'THINK';
                if (callbacks.onThinking) {
                  callbacks.onThinking(value);
                } else {
                  callbacks.onContent(`[Thinking] ${value}\n`);
                }
              } else if (
                path === 'response/content' ||
                path?.endsWith('/content')
              ) {
                // Content update
                // If path is EXACTLY 'response/content', it's main content (DeepSeek non-reasoner or standard output)
                if (path === 'response/content') {
                  currentMode = 'RESPONSE'; // Force switch to response
                  callbacks.onContent(value);
                } else {
                  // If path is fragment content (e.g. fragments/-1/content), respect currentMode
                  if (currentMode === 'THINK') {
                    if (callbacks.onThinking) {
                      callbacks.onThinking(value);
                    } else {
                      callbacks.onContent(`[Thinking] ${value}\n`);
                    }
                  } else {
                    callbacks.onContent(value);
                  }
                }
              } else if (!path) {
                // Implicit content update
                // Default to RESPONSE unless clearly in THINK mode from a recent fragment
                // But for safety against "stuck" think mode, we might want to be careful.
                // However, without path, we must rely on currentMode.
                if (currentMode === 'THINK') {
                  if (callbacks.onThinking) {
                    callbacks.onThinking(value);
                  } else {
                    callbacks.onContent(`[Thinking] ${value}\n`);
                  }
                } else {
                  callbacks.onContent(value);
                }
              }
            } else if (
              Array.isArray(json.v) &&
              json.p === 'response/fragments'
            ) {
              // Handle fragment arrays involving THINK or RESPONSE
              const fragment = json.v[0];
              if (fragment) {
                if (fragment.type === 'THINK') {
                  currentMode = 'THINK';
                  if (fragment.content) {
                    if (callbacks.onThinking) {
                      callbacks.onThinking(fragment.content);
                    } else {
                      callbacks.onContent(`[Thinking] ${fragment.content}\n`);
                    }
                  }
                } else if (fragment.type === 'RESPONSE') {
                  currentMode = 'RESPONSE';
                  if (fragment.content) {
                    callbacks.onContent(fragment.content);
                  }
                }
              }
            } else if (json.o === 'BATCH' && Array.isArray(json.v)) {
              // Handle token usage from BATCH op
              // e.g. [{"p":"status","v":"FINISHED"},{"p":"accumulated_token_usage","v":107}]
              const usageItem = json.v.find(
                (item: any) => item.p === 'accumulated_token_usage',
              );
              if (usageItem && typeof usageItem.v === 'number') {
                if (callbacks.onMetadata) {
                  callbacks.onMetadata({
                    usage: { total_tokens: usageItem.v },
                  });
                }
              }
            } else if (
              json.p?.endsWith('/elapsed_secs') ||
              json.p?.endsWith('thinking_elapsed_secs')
            ) {
              // Handle elapsed time for thinking
              // Log: {"p":"response/fragments/-1/elapsed_secs","o":"SET","v":9.918728716}
              // This comes AFTER thinking is done (usually).
              // We should check if currentMode was THINK or if this is relevant to thinking.
              // Assuming this marks end of thinking or update of thinking time.
              if (callbacks.onMetadata) {
                callbacks.onMetadata({
                  thinking_elapsed: json.v,
                });
              }
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    // If it was a new session, try to fetch title
    if (!payload.conversation_id && sessionId) {
      let title = null;
      try {
        // 1. Try Auto-Rename
        const renameRes = await client.post(
          '/api/v0/chat_session/auto_rename',
          {
            chat_session_id: sessionId,
          },
        );

        if (renameRes.ok) {
          const renameData = await renameRes.json();
          title = renameData?.data?.biz_data?.title;
        }

        // 2. If no title, try fetching session list fallback
        if (!title) {
          // We can reuse getChatSessions logic or call fetch_page directly
          // getChatSessions is not exported/available in this context easily unless imported or copied.
          // Let's just make the request.
          const listRes = await client.get(
            '/api/v0/chat_session/fetch_page?count=20',
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            const sessions = listData?.data?.biz_data?.chat_sessions || [];
            const currentSession = sessions.find(
              (s: any) => s.id === sessionId,
            );
            if (currentSession) {
              title = currentSession.title;
            }
          }
        }

        if (callbacks.onMetadata) {
          callbacks.onMetadata({
            conversation_title: title,
          });
        }
      } catch (e) {
        console.warn('[DeepSeek] Failed to fetch title:', e);
        if (callbacks.onMetadata) {
          callbacks.onMetadata({
            conversation_title: null,
          });
        }
      }
    }

    // Always emit conversation_id at the end if we have one
    if (sessionId && callbacks.onMetadata) {
      callbacks.onMetadata({
        conversation_id: sessionId,
      });
    }

    // console.log('[DeepSeek] Loop finished');
    callbacks.onDone();
  } catch (error: any) {
    console.error('[DeepSeek] Chat error:', error);
    callbacks.onError(error);
  }
}

export async function uploadFile(
  token: string,
  file: Express.Multer.File,
  userAgent?: string,
): Promise<{ id: string; token_usage: number }> {
  const baseHeaders = {
    Cookie: `DS-AUTH-TOKEN=${token}`,
    Authorization: token,
    'User-Agent':
      userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    Origin: 'https://chat.deepseek.com',
    Referer: 'https://chat.deepseek.com/',
  };

  const client = new HttpClient({
    baseURL: 'https://chat.deepseek.com',
    headers: baseHeaders,
  });

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
        console.log('[DeepSeek Upload] Solving PoW...');
        const powAnswer = await solvePoW(challengeData);
        powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
          'base64',
        );
      }
    } else {
      console.warn(
        '[DeepSeek Upload] Failed to get PoW challenge, proceeding without it.',
      );
    }

    // 2. Construct Multipart Payload
    const boundary =
      '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const crlf = '\r\n';

    // Ensure filename is safe (basic sanitization if needed, but originalname usually fine)
    const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${file.originalname}"${crlf}Content-Type: ${file.mimetype}${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;

    // Combine buffers
    const payloadBuffer = Buffer.concat([
      Buffer.from(header),
      file.buffer,
      Buffer.from(footer),
    ]);

    // 3. Send Request
    // We specify manual headers to override node-fetch/HttpClient behavior for multipart
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

    // Direct fetch call since we need raw buffer body support
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
    console.log('[DeepSeek Upload] Result:', JSON.stringify(result, null, 2));

    if (result.code === 0 && result.data?.biz_data?.id) {
      const fileId = result.data.biz_data.id;

      // Polling for status
      console.log(`[DeepSeek Upload] Polling status for ${fileId}...`);
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
            // console.log('[DeepSeek Upload] Poll response:', JSON.stringify(listData));
            const files = listData?.data?.biz_data?.files || [];
            const targetFile = files.find((f: any) => f.id === fileId);

            if (targetFile) {
              console.log(
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
                throw new Error(`File processing failed: ${targetFile.status}`);
              }
            }
          }
        } catch (e) {
          console.warn('[DeepSeek Upload] Polling check failed', e);
        }
        attempts++;
      }
      // Return anyway if timeout, maybe it will work?
      console.warn(
        '[DeepSeek Upload] Timed out waiting for file status, proceeding...',
      );
      return { id: fileId, token_usage: 0 };
    } else {
      throw new Error(`Upload failed: ${result.msg || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('[DeepSeek Upload] Error:', error);
    throw error;
  }
}
