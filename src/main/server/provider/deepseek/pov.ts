import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { PoWChallenge, PoWResponse } from './types';

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
export async function solvePoW(challenge: PoWChallenge): Promise<PoWResponse> {
  if (!dsHash) {
    const possiblePaths: string[] = [];

    if (app.isPackaged) {
      // Production: Try multiple possible locations
      possiblePaths.push(
        // Location 1: extraResources creates resources/resources/ nesting
        path.join(process.resourcesPath, 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm'),
        // Location 2: app.asar.unpacked/resources/ (most common for asarUnpack)
        path.join(
          process.resourcesPath,
          'app.asar.unpacked',
          'resources',
          'sha3_wasm_bg.7b9ca65ddd.wasm',
        ),
        // Location 3: In app.asar.unpacked at root level
        path.join(process.resourcesPath, 'app.asar.unpacked', 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      );
    } else {
      // Development: Look in project resources folder
      possiblePaths.push(
        path.join(process.cwd(), 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm'),
        path.join(__dirname, '../../../resources', 'sha3_wasm_bg.7b9ca65ddd.wasm'), // Adjusted path
      );
    }

    let wasmPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        wasmPath = p;
        console.log('[DeepSeek PoW] Found WASM at:', wasmPath);
        break;
      }
    }

    if (!wasmPath) {
      console.error('[DeepSeek PoW] WASM file not found. Tried paths:', possiblePaths);
      console.error('[DeepSeek PoW] process.resourcesPath:', process.resourcesPath);
      console.error('[DeepSeek PoW] process.cwd():', process.cwd());
      console.error('[DeepSeek PoW] __dirname:', __dirname);
      console.error('[DeepSeek PoW] app.isPackaged:', app.isPackaged);
      throw new Error('WASM file not found for DeepSeek PoW');
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
