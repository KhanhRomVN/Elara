/// <reference lib="webworker" />

import { net, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatPayload {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  thinking?: boolean;
  search?: boolean;
  conversation_id?: string;
  parent_message_id?: string;
  ref_file_ids?: string[];
}

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
    const malloc = this.instance.exports.__wbindgen_export_0 as CallableFunction;
    const ptr = malloc(length, 1) as number;

    const memoryView = new Uint8Array(this.memory.buffer);
    memoryView.set(encoded, ptr);

    return [ptr, length];
  }

  // Calculate Hash
  calculateHash(difficulty: number, challenge: string, prefix: string): number | null {
    if (!this.instance || !this.memory) throw new Error('WASM not initialized');

    const stackPointerFn = this.instance.exports
      .__wbindgen_add_to_stack_pointer as CallableFunction;
    const solveFn = this.instance.exports.wasm_solve as CallableFunction;

    const retptr = stackPointerFn(-16) as number;

    try {
      const [challengePtr, challengeLen] = this.writeToMemory(challenge);
      const [prefixPtr, prefixLen] = this.writeToMemory(prefix);

      // wasm_solve(retptr, challenge_ptr, challenge_len, prefix_ptr, prefix_len, difficulty)
      solveFn(retptr, challengePtr, challengeLen, prefixPtr, prefixLen, difficulty);

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
    let wasmPath = '';

    if (app.isPackaged) {
      // When using asarUnpack, files are extracted to app.asar.unpacked/
      wasmPath = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'resources',
        'sha3_wasm_bg.7b9ca65ddd.wasm',
      );
      if (!fs.existsSync(wasmPath)) {
        // Fallback: try without app.asar.unpacked for some setups
        wasmPath = path.join(process.resourcesPath, 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm');
      }
    } else {
      wasmPath = path.join(process.cwd(), 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm');
    }

    dsHash = new DeepSeekHash(wasmPath);
    await dsHash.init();
  }

  // Format: salt_expireAt_
  const prefix = `${challenge.salt}_${challenge.expire_at}_`;

  const answer = dsHash!.calculateHash(challenge.difficulty, challenge.challenge, prefix);

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

export async function chatCompletionStream(
  token: string,
  payload: ChatPayload,
  userAgent: string | undefined,
  callbacks: {
    onContent: (content: string) => void;
    onThinking?: (content: string) => void;
    onRaw?: (data: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    onSessionCreated?: (sessionId: string) => void;
  },
) {
  console.log(
    '[DeepSeek Chat Debug] Starting chatCompletionStream with payload:',
    JSON.stringify(payload, null, 2),
  );
  try {
    const apiBase = 'https://chat.deepseek.com/api/v0';
    const origin = 'https://chat.deepseek.com';

    // Helper for requests
    const makeRequest = (
      url: string,
      method: string,
      body?: any,
      additionalHeaders: Record<string, string> = {},
    ) => {
      return new Promise<any>((resolve, reject) => {
        const req = net.request({ method, url, useSessionCookies: true });
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', token);
        req.setHeader('Origin', origin);
        req.setHeader('Referer', `${origin}/`);
        // Add headers to mimic real browser
        req.setHeader('sec-ch-ua-platform', '"Linux"');
        req.setHeader(
          'sec-ch-ua',
          '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        );
        req.setHeader('sec-ch-ua-mobile', '?0');
        req.setHeader('accept-language', 'en-US,en;q=0.9');

        if (userAgent) req.setHeader('User-Agent', userAgent);

        Object.entries(additionalHeaders).forEach(([k, v]) => req.setHeader(k, v));

        req.on('response', (response) => {
          let data = '';
          response.on('data', (chunk) => (data += chunk.toString()));

          response.on('end', () => {
            // Handle 200-299 responses
            if (response.statusCode >= 200 && response.statusCode < 400) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                resolve(data);
              }
            } else {
              reject(new Error(`Request to ${url} failed: ${response.statusCode} ${data}`));
            }
          });
          response.on('error', reject);
        });

        req.on('error', reject);

        if (body) {
          req.write(JSON.stringify(body));
        }
        req.end();
      });
    };

    // 1. Create Chat Session (if not provided)
    let sessionId = payload.conversation_id;
    if (!sessionId) {
      const sessionRes = await makeRequest(`${apiBase}/chat_session/create`, 'POST', {
        character_id: null,
      });

      sessionId = sessionRes?.data?.biz_data?.id;
      if (!sessionId) {
        throw new Error('Failed to create chat session: No ID returned');
      }
    }

    if (callbacks.onSessionCreated) {
      callbacks.onSessionCreated(sessionId);
    }

    // 2. Request PoW Challenge
    console.log('[DeepSeek Chat Debug] Requesting PoW Challenge...');
    const challengeRes = await makeRequest(
      `${apiBase}/chat/create_pow_challenge`,
      'POST',
      { target_path: '/api/v0/chat/completion' },
      { Referer: `${origin}/a/chat/s/${sessionId}` },
    );
    console.log(
      '[DeepSeek Chat Debug] PoW Challenge received:',
      challengeRes?.data?.biz_data?.challenge?.challenge,
    );

    const challengeData: PoWChallenge = challengeRes?.data?.biz_data?.challenge;
    if (!challengeData) {
      throw new Error('Failed to get PoW challenge');
    }

    // 3. Solve PoW
    console.log('[DeepSeek Chat Debug] Solving PoW...');
    const powAnswer = await solvePoW(challengeData);
    const powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString('base64');
    console.log('[DeepSeek Chat Debug] PoW Solved. Challenge:', powAnswer.challenge);

    // 4. Send Chat Completion
    console.log('[DeepSeek Chat Debug] Sending Chat Completion Request...');

    // Payload matching deepseek4free
    const webPayload = {
      chat_session_id: sessionId,
      parent_message_id: payload.parent_message_id || null,
      prompt: payload.messages[payload.messages.length - 1].content,
      ref_file_ids: payload.ref_file_ids || [],
      thinking_enabled: payload.thinking ?? true, // Map our 'thinking' param to DeepSeek's 'thinking_enabled'
      search_enabled: payload.search ?? false, // Map our 'search' param to DeepSeek's 'search_enabled'
    };

    console.log('[DeepSeek Chat Debug] Web Payload:', JSON.stringify(webPayload, null, 2));

    const request = net.request({
      method: 'POST',
      url: `${apiBase}/chat/completion`,
      useSessionCookies: true,
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('Authorization', token);
    request.setHeader('Origin', origin);
    request.setHeader('Referer', `${origin}/`);
    request.setHeader('Accept', 'text/event-stream');
    request.setHeader('X-Ds-Pow-Response', powResponseBase64);
    request.setHeader('X-App-Version', '20241129.1');
    request.setHeader('X-Client-Locale', 'en_US');
    request.setHeader('X-Client-Platform', 'web');
    request.setHeader('X-Client-Version', '1.0.0-always');
    // Add headers to mimic real browser
    request.setHeader('sec-ch-ua-platform', '"Linux"');
    request.setHeader(
      'sec-ch-ua',
      '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    );
    request.setHeader('sec-ch-ua-mobile', '?0');
    request.setHeader('accept-language', 'en-US,en;q=0.9');

    if (userAgent) request.setHeader('User-Agent', userAgent);

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        let errBody = '';
        response.on('data', (c) => (errBody += c));
        response.on('end', () =>
          callbacks.onError(new Error(`API Error ${response.statusCode}: ${errBody}`)),
        );
        return;
      }

      let buffer = '';
      const textDecoder = new TextDecoder();
      response.on('data', (chunk) => {
        const chunkStr =
          typeof chunk === 'string' ? chunk : textDecoder.decode(chunk, { stream: true });

        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      });

      response.on('end', () => {
        if (buffer.trim()) processLine(buffer);
        callbacks.onDone();
      });
    });

    function processLine(line: string) {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (!trimmed.startsWith('data: ')) {
        return;
      }

      const dataStr = trimmed.slice(6);
      if (dataStr === '[DONE]') return;

      // If onRaw is provided, pass the raw data string (content of the data: part)
      if (callbacks.onRaw) {
        callbacks.onRaw(dataStr);
        return;
      }

      try {
        const data = JSON.parse(dataStr);
        // Handle stream format
        if (typeof data.v === 'string') {
          callbacks.onContent(data.v);
        } else if (data.choices?.[0]?.delta?.content) {
          callbacks.onContent(data.choices[0].delta.content);
        }
      } catch (e) {
        // Skip lines that fail to parse
      }
    }

    request.on('error', (err) => {
      console.error('[DeepSeek Chat Debug] Request Error:', err);
      callbacks.onError(err);
    });
    request.on('finish', () => console.log('[DeepSeek Chat Debug] Request Finished (Flushed)'));
    request.on('close', () => console.log('[DeepSeek Chat Debug] Request Closed'));
    request.on('abort', () => console.log('[DeepSeek Chat Debug] Request Aborted'));

    request.write(JSON.stringify(webPayload));
    request.end();
  } catch (error: any) {
    console.error('[API] Fatal Error:', error);
    callbacks.onError(error);
  }
}

// Get DeepSeek chat session history
export async function getChatSessions(
  token: string,
  userAgent?: string,
  pinnedOnly: boolean = false,
): Promise<any> {
  try {
    const apiBase = 'https://chat.deepseek.com/api/v0';
    const origin = 'https://chat.deepseek.com';

    const url = `${apiBase}/chat_session/fetch_page?lte_cursor.pinned=${pinnedOnly}`;

    const request = net.request({
      method: 'GET',
      url,
      useSessionCookies: true,
    });

    request.setHeader('Authorization', token);
    request.setHeader('Origin', origin);
    request.setHeader('Referer', `${origin}/`);
    request.setHeader('Accept', '*/*');
    request.setHeader('x-client-locale', 'en_US');
    request.setHeader('x-app-version', '20241129.1');
    request.setHeader('x-client-version', '1.6.1');
    request.setHeader('x-client-platform', 'web');
    // Add headers to mimic real browser
    request.setHeader('sec-ch-ua-platform', '"Linux"');
    request.setHeader(
      'sec-ch-ua',
      '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    );
    request.setHeader('sec-ch-ua-mobile', '?0');
    request.setHeader('accept-language', 'en-US,en;q=0.9');

    if (userAgent) request.setHeader('User-Agent', userAgent);

    return new Promise((resolve, reject) => {
      let data = '';

      request.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.code === 0 && parsed.data?.biz_data?.chat_sessions) {
                resolve(parsed.data.biz_data.chat_sessions);
              } else {
                reject(new Error(`Failed to get chat sessions: ${parsed.msg || 'Unknown error'}`));
              }
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`Failed to get chat sessions: ${response.statusCode}`));
          }
        });
      });

      request.on('error', reject);
      request.end();
    });
  } catch (error: any) {
    throw error;
  }
}

// Get DeepSeek chat history messages
export async function getChatHistory(
  token: string,
  sessionId: string,
  userAgent?: string,
): Promise<any> {
  try {
    const apiBase = 'https://chat.deepseek.com/api/v0';
    const origin = 'https://chat.deepseek.com';

    const url = `${apiBase}/chat/history_messages?chat_session_id=${sessionId}`;

    const request = net.request({
      method: 'GET',
      url,
      useSessionCookies: true,
    });

    request.setHeader('Authorization', token);
    request.setHeader('Origin', origin);
    request.setHeader('Referer', `${origin}/a/chat/s/${sessionId}`);
    request.setHeader('Accept', '*/*');
    request.setHeader('x-client-locale', 'en_US');
    request.setHeader('x-app-version', '20241129.1');
    request.setHeader('x-client-version', '1.6.1');
    request.setHeader('x-client-platform', 'web');
    // Add headers to mimic real browser
    request.setHeader('sec-ch-ua-platform', '"Linux"');
    request.setHeader(
      'sec-ch-ua',
      '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    );
    request.setHeader('sec-ch-ua-mobile', '?0');
    request.setHeader('accept-language', 'en-US,en;q=0.9');

    if (userAgent) request.setHeader('User-Agent', userAgent);

    return new Promise((resolve, reject) => {
      let data = '';

      request.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.code === 0 && parsed.data?.biz_data) {
                resolve(parsed.data.biz_data);
              } else {
                reject(new Error(`Failed to get chat history: ${parsed.msg || 'Unknown error'}`));
              }
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`Failed to get chat history: ${response.statusCode}`));
          }
        });
      });

      request.on('error', reject);
      request.end();
    });
  } catch (error: any) {
    throw error;
  }
}

// Stop DeepSeek stream
export async function stopStream(
  token: string,
  sessionId: string,
  messageId: number,
  userAgent?: string,
): Promise<any> {
  try {
    const apiBase = 'https://chat.deepseek.com/api/v0';
    const origin = 'https://chat.deepseek.com';
    const url = `${apiBase}/chat/stop_stream`;

    const request = net.request({
      method: 'POST',
      url,
      useSessionCookies: true,
    });

    request.setHeader('Authorization', token);
    request.setHeader('Origin', origin);
    request.setHeader('Referer', `${origin}/a/chat/s/${sessionId}`);
    request.setHeader('Accept', '*/*');
    request.setHeader('Content-Type', 'application/json');
    request.setHeader('x-client-locale', 'en_US');
    request.setHeader('x-app-version', '20241129.1');
    request.setHeader('x-client-version', '1.6.1');
    request.setHeader('x-client-platform', 'web');
    // Add headers to mimic real browser
    request.setHeader('sec-ch-ua-platform', '"Linux"');
    request.setHeader(
      'sec-ch-ua',
      '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    );
    request.setHeader('sec-ch-ua-mobile', '?0');
    request.setHeader('accept-language', 'en-US,en;q=0.9');

    if (userAgent) request.setHeader('User-Agent', userAgent);

    const body = JSON.stringify({
      chat_session_id: sessionId,
      message_id: messageId,
    });

    return new Promise((resolve, reject) => {
      let data = '';

      request.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`Failed to stop stream: ${response.statusCode}`));
          }
        });
      });

      request.on('error', reject);
      request.write(body);
      request.end();
    });
  } catch (error: any) {
    throw error;
  }
}

// Upload file to DeepSeek
export async function uploadFile(
  token: string,
  fileContent: string, // Base64
  fileName: string,
  userAgent?: string,
): Promise<string> {
  try {
    const apiBase = 'https://chat.deepseek.com/api/v0';
    const origin = 'https://chat.deepseek.com';
    const url = `${apiBase}/file/upload_file`;

    // Helper for pre-upload requests (PoW)
    const makeRequest = (
      url: string,
      method: string,
      body?: any,
      additionalHeaders: Record<string, string> = {},
    ) => {
      return new Promise<any>((resolve, reject) => {
        const req = net.request({ method, url, useSessionCookies: true });
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', token.trim());
        req.setHeader('Origin', origin);
        req.setHeader('Referer', `${origin}/`);
        if (userAgent) {
          req.setHeader('User-Agent', userAgent.trim());
        }

        Object.entries(additionalHeaders).forEach(([k, v]) => req.setHeader(k, v));

        req.on('response', (response) => {
          let data = '';
          response.on('data', (chunk) => (data += chunk.toString()));
          response.on('end', () => {
            if (response.statusCode >= 200 && response.statusCode < 400) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                resolve(data);
              }
            } else {
              reject(new Error(`Request to ${url} failed: ${response.statusCode} ${data}`));
            }
          });
          response.on('error', reject);
        });

        req.on('error', reject);

        if (body) {
          req.write(JSON.stringify(body));
        }
        req.end();
      });
    };

    // 1. Get PoW Challenge
    const challengeRes = await makeRequest(`${apiBase}/chat/create_pow_challenge`, 'POST', {
      target_path: '/api/v0/file/upload_file',
    });

    const challengeData = challengeRes?.data?.biz_data?.challenge;
    if (!challengeData) {
      console.warn('DeepSeek Upload: Failed to get PoW challenge, proceeding without it.');
    }

    let powResponseBase64 = '';
    if (challengeData) {
      try {
        const powAnswer = await solvePoW(challengeData);
        powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString('base64');
      } catch (e) {
        console.error('DeepSeek Upload: Failed to solve PoW', e);
      }
    }

    // Convert base64 to Buffer
    const buffer = Buffer.from(fileContent.replace(/^data:.*,/, ''), 'base64');

    // Construct Multipart Body manually since we can't easily use FormData with net.request
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    // Simpler Manual Construction for correctness:
    const crlf = '\r\n';
    const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${fileName}"${crlf}Content-Type: application/octet-stream${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;

    const payloadBuffer = Buffer.concat([Buffer.from(header), buffer, Buffer.from(footer)]);

    const request = net.request({
      method: 'POST',
      url,
      useSessionCookies: true,
    });

    const headersToSet: Record<string, string> = {
      Authorization: token.trim(),
      Origin: origin,
      Referer: `${origin}/`,
      Accept: '*/*',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'x-client-locale': 'en_US',
      'x-app-version': '20241129.1',
      'x-client-version': '1.6.1',
      'x-client-platform': 'web',
      'x-file-size': buffer.length.toString(),
    };

    if (powResponseBase64) {
      headersToSet['x-ds-pow-response'] = powResponseBase64;
    }

    if (userAgent) {
      headersToSet['User-Agent'] = userAgent.trim();
    }

    Object.entries(headersToSet).forEach(([key, value]) => {
      request.setHeader(key, value);
    });

    return new Promise((resolve, reject) => {
      let data = '';

      request.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              console.log('[DeepSeek Upload Debug] Response:', JSON.stringify(parsed, null, 2));
              if (parsed.code === 0 && parsed.data?.biz_data?.id) {
                console.log('[DeepSeek Upload Debug] Captured File ID:', parsed.data.biz_data.id);
                resolve(parsed.data.biz_data.id);
              } else {
                reject(new Error(`Failed to upload file: ${parsed.msg || 'Unknown error'}`));
              }
            } catch (e) {
              reject(e);
            }
          } else {
            console.error('DeepSeek Upload Failed:', response.statusCode, data);
            reject(new Error(`Failed to upload file: ${response.statusCode}`));
          }
        });
      });

      request.on('error', reject);
      request.write(payloadBuffer);
      request.end();
    });
  } catch (error: any) {
    throw error;
  }
}
