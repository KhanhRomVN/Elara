/**
 * ------------------------------------------------------------------
 * Chat Service
 * ------------------------------------------------------------------
 * Service core orchestration: gửi tin nhắn qua provider,
 * ghi nhận metrics, quản lý conversation lock, session store,
 * và request queue cho CLI proxy endpoints.
 *
 * Main functions:
 * - sendMessage()               : Gửi tin nhắn qua provider và xử lý response
 * - generateId()                : Tạo ID ngẫu nhiên
 * - getSessionKey()             : Lấy session key từ request
 * - extractCliSessionId()       : Trích xuất CLI session ID từ metadata
 * - generateSessionFingerprint(): Tạo fingerprint cho session
 * - isResetCommand()            : Kiểm tra lệnh reset
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import { Request } from 'express';

// ── Types ──
import type { SendMessageOptions } from '../types';

// ── Providers ──
import { providerRegistry } from '../provider/registry';
import { isProviderEnabled } from './provider.service';

// ── Metrics ──
import { recordChatMetrics, recordError } from './metrics.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ChatService');

// ─── State ──────────────────────────────────────────────────────────────

export const sessionStore = new Map<string, string>();
export const requestQueue = new Map<string, Promise<void>>();

// ─── Session Helpers ────────────────────────────────────────────────────

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

// ─── Main Function ─────────────────────────────────────────────────────

export const sendMessage = async (
  options: SendMessageOptions,
): Promise<void> => {
  const {
    provider_id,
    messages,
    onContent,
    onDone,
    onSessionCreated,
    accountId,
  } = options;

  if (!(await isProviderEnabled(provider_id))) {
    const error = new Error(`Provider ${provider_id} is disabled`);
    recordError(
      accountId,
      provider_id,
      options.model || 'unknown',
      error.message,
    );
    throw error;
  }

  const provider = providerRegistry.getProvider(provider_id);
  if (!provider) {
    const error = new Error(
      `Provider ${provider_id} not supported for sending messages`,
    );
    recordError(
      accountId,
      provider_id,
      options.model || 'unknown',
      error.message,
    );
    throw error;
  }

  let accumulatedAssistantContent = '';

  const wrappedOptions: SendMessageOptions = {
    ...options,
    onContent: (content: string) => {
      accumulatedAssistantContent += content;
      if (onContent) onContent(content);
    },
    onSessionCreated: (sessionId: string) => {
      if (onSessionCreated) onSessionCreated(sessionId);
    },
    onDone: () => {
      if (!accumulatedAssistantContent) {
        logger.warn(
          `[sendMessage] Provider ${provider_id} completed with empty content`,
        );
      }

      recordChatMetrics(
        accountId,
        provider_id,
        options.model || 'unknown',
        messages,
        accumulatedAssistantContent,
      );

      if (onDone) onDone();
    },
  };

  try {
    return await provider.handleMessage(wrappedOptions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordError(
      accountId,
      provider_id,
      options.model || 'unknown',
      errorMessage,
    );
    throw error;
  }
};