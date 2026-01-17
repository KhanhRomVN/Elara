import { HttpClient } from '../../utils/http-client';
import * as fs from 'fs';
import * as path from 'path';

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
    const wasmPath = path.resolve(__dirname, '../../utils/sha3_wasm_bg.wasm');
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
  thinking?: boolean;
  conversation_id?: string;
  parent_message_id?: string;
  ref_file_ids?: string[];
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

    // Auto-fetch parent_message_id if not provided
    let parentMessageId: number | undefined | null = payload.parent_message_id
      ? Number(payload.parent_message_id)
      : undefined;
    if (payload.conversation_id && !parentMessageId) {
      console.log('[DeepSeek] No parent_message_id provided, auto-fetching...');
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

    const requestPayload: any = {
      chat_session_id: sessionId,
      parent_message_id: parentMessageId || null,
      prompt: payload.messages[payload.messages.length - 1].content,
      ref_file_ids: payload.ref_file_ids || [],
      thinking_enabled:
        payload.model === 'deepseek-reasoner' || payload.thinking === true,
      search_enabled: payload.search || false,
    };

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

    for await (const chunk of response.body) {
      const chunkStr = chunk.toString();
      // console.log('[DeepSeek] Raw chunk:', chunkStr); // Too noisy usually, but enable if needed
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
              // Check path or implicitly assume content if path is missing or points to content
              // Based on log: {"v":" Hello"}, {"p":"response/content","o":"APPEND","v":"Hello"}
              // And: {"p":"response/thinking_content","v":"..."}

              const path = json.p;
              const value = json.v;
              const thinkingEnabled =
                payload.model === 'deepseek-reasoner' ||
                payload.thinking === true;

              if (
                path === 'response/thinking_content' ||
                path?.endsWith('thinking_content')
              ) {
                // Only append thinking content if thinking is enabled
                if (thinkingEnabled && json.v) {
                  callbacks.onContent(`[Thinking] ${json.v}\n`);
                }
              } else if (
                !path ||
                path === 'response/content' ||
                path.endsWith('/content')
              ) {
                // It's main content
                callbacks.onContent(value);
              }
            } else if (
              Array.isArray(json.v) &&
              json.p === 'response/fragments'
            ) {
              // Handle fragment arrays involving THINK or RESPONSE
              const fragment = json.v[0];
              if (fragment && fragment.content) {
                if (fragment.type === 'THINK') {
                  callbacks.onContent(`[Thinking] ${fragment.content}\n`);
                } else {
                  callbacks.onContent(fragment.content);
                }
              }
            } else if (json.o === 'BATCH' && Array.isArray(json.v)) {
              // Handle token usage from BATCH op
              // e.g. [{"p":"status","v":"FINISHED"},{"p":"accumulated_token_usage","v":107}]
              const usageItem = json.v.find(
                (item: any) => item.p === 'accumulated_token_usage',
              );
              if (usageItem && typeof usageItem.v === 'number') {
                // console.log('[DeepSeek] Token usage:', usageItem.v);
                if (callbacks.onMetadata) {
                  callbacks.onMetadata({
                    usage: { total_tokens: usageItem.v },
                  });
                }
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
