/**
 * ------------------------------------------------------------------
 * Chat Session Service
 * ------------------------------------------------------------------
 * Quản lý session store và request queue cho CLI proxy endpoints.
 * Hỗ trợ tạo fingerprint từ API key và messages.
 *
 * Main functions:
 * - generateId()              : Tạo ID ngẫu nhiên
 * - getSessionKey()           : Lấy session key từ request
 * - extractCliSessionId()     : Trích xuất CLI session ID từ metadata
 * - generateSessionFingerprint(): Tạo fingerprint cho session
 * - isResetCommand()          : Kiểm tra lệnh reset
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import { Request, Response } from 'express';

// ─── State ──────────────────────────────────────────────────────────────

export const sessionStore = new Map<string, string>();
export const requestQueue = new Map<string, Promise<void>>();

// ─── Functions ──────────────────────────────────────────────────────────

export function generateId(prefix: string = 'msg_'): string {
  return `${prefix}${crypto.randomUUID()}`;
}

export function getSessionKey(req: Request): string {
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string') return apiKey;

  const auth = req.headers['authorization'];
  if (auth) return auth;

  return req.ip || 'default';
}

export function extractCliSessionId(body: any): string | null {
  const metadata = body.metadata;
  if (!metadata) return null;

  if (metadata.sessionId) return metadata.sessionId;

  if (metadata.user_id && typeof metadata.user_id === 'string') {
    const parts = metadata.user_id.split('__session_');
    if (parts.length > 1) return parts[1];

    const sessionMatch = metadata.user_id.match(/session_([a-f0-9-]+)/i);
    if (sessionMatch) return sessionMatch[1];
  }

  return null;
}

export function generateSessionFingerprint(
  apiKey: string,
  messages: any[],
  body: any,
): string {
  const cliSessionId = extractCliSessionId(body);

  const keyHash = crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex')
    .substring(0, 8);

  if (cliSessionId) {
    return `sess_${keyHash}_cli_${cliSessionId}`;
  }

  let firstUserMsg = '';
  if (messages && messages.length > 0) {
    for (const msg of messages.slice(0, 5)) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          firstUserMsg = msg.content;
        } else if (Array.isArray(msg.content)) {
          firstUserMsg = msg.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join(' ');
        }
        break;
      }
    }
  }

  const contentHash = crypto
    .createHash('sha256')
    .update(firstUserMsg.trim())
    .digest('hex')
    .substring(0, 16);

  return `sess_${keyHash}_${contentHash}`;
}

export function isResetCommand(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
    const cmd = lastMsg.content.trim().toLowerCase();
    return cmd === '/reset' || cmd === '!reset';
  }
  return false;
}