import { net, app } from 'electron';
import crypto from 'crypto';
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
  console.log('[PoW] Solving challenge:', challenge);

  if (!dsHash) {
    let wasmPath = '';

    if (app.isPackaged) {
      wasmPath = path.join(process.resourcesPath, 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm');
      if (!fs.existsSync(wasmPath)) {
        // Try alternative path without inner resources mainly for some setups
        wasmPath = path.join(process.resourcesPath, 'sha3_wasm_bg.7b9ca65ddd.wasm');
      }
    } else {
      wasmPath = path.join(process.cwd(), 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm');
    }

    console.log('[PoW] Loading WASM from:', wasmPath);
    dsHash = new DeepSeekHash(wasmPath);
    await dsHash.init();
  }

  const start = Date.now();

  // Format: salt_expireAt_
  const prefix = `${challenge.salt}_${challenge.expire_at}_`;

  console.log(`[PoW] Solving with Prefix: "${prefix}", Difficulty: ${challenge.difficulty}`);

  const answer = dsHash!.calculateHash(challenge.difficulty, challenge.challenge, prefix);

  const duration = Date.now() - start;

  if (answer !== null) {
    console.log(`[PoW] Solved in ${duration}ms. Answer: ${answer}`);
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
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
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

    // 1. Create Chat Session
    console.log('[API] Creating Chat Session...');
    const sessionRes = await makeRequest(`${apiBase}/chat_session/create`, 'POST', {
      character_id: null,
    });

    const sessionId = sessionRes?.data?.biz_data?.id;
    if (!sessionId) {
      throw new Error('Failed to create chat session: No ID returned');
    }
    console.log('[API] Chat Session Created:', sessionId);

    // 2. Request PoW Challenge
    console.log('[API] Requesting PoW Challenge...');
    const challengeRes = await makeRequest(
      `${apiBase}/chat/create_pow_challenge`,
      'POST',
      { target_path: '/api/v0/chat/completion' },
      { Referer: `${origin}/a/chat/s/${sessionId}` },
    );

    const challengeData: PoWChallenge = challengeRes?.data?.biz_data?.challenge;
    if (!challengeData) {
      throw new Error('Failed to get PoW challenge');
    }

    // 3. Solve PoW
    console.log('[API] Solving PoW...');
    const powAnswer = await solvePoW(challengeData);
    const powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString('base64');

    // 4. Send Chat Completion
    console.log('[API] Sending Completion Request...');

    const clientStreamId = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${crypto.randomBytes(8).toString('hex')}`;

    // Payload matching deepseek4free
    const webPayload = {
      chat_session_id: sessionId,
      parent_message_id: null,
      prompt: payload.messages[payload.messages.length - 1].content,
      ref_file_ids: [],
      thinking_enabled: true, // Force thinking enabled for now, or make it configurable
      search_enabled: false,
    };

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

    if (userAgent) request.setHeader('User-Agent', userAgent);

    request.on('response', (response) => {
      console.log(`[API] Completion Status: ${response.statusCode}`);

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
        console.log('[API] Stream ended');
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

      try {
        const data = JSON.parse(dataStr);
        // Handle stream format
        if (typeof data.v === 'string') {
          callbacks.onContent(data.v);
        } else if (data.choices?.[0]?.delta?.content) {
          callbacks.onContent(data.choices[0].delta.content);
        }
      } catch (e) {
        console.error('[API Debug] Parse error for line:', line, e);
      }
    }

    request.on('error', (err) => callbacks.onError(err));
    request.write(JSON.stringify(webPayload));
    request.end();
  } catch (error: any) {
    console.error('[API] Fatal Error:', error);
    callbacks.onError(error);
  }
}
