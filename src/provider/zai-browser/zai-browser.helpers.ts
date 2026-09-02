/**
 * ------------------------------------------------------------------
 * Z.AI Browser Helpers
 * ------------------------------------------------------------------
 * Helper functions cho Z.AI Browser provider.
 *
 * Main functions:
 * - parseZaiBrowserCredential() : Parse credential thành cookie + userAgent
 * - extractEmailFromCookie()    : Extract email từ cookie
 * - sanitizeCookieForExtension(): Sanitize cookie cho extension
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ParsedZaiCredential } from './zai-browser.types';
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ZaiBrowserHelpers');

// ─── Functions ──────────────────────────────────────────────────────────

export const parseZaiBrowserCredential = (credential: string): ParsedZaiCredential | null => {
  const parts = credential.split('|||');
  if (parts.length < 2) {
    logger.warn(`[ZaiBrowser] Invalid credential format, expected "cookie|||user_agent"`);
    return null;
  }
  return {
    cookie: parts[0],
    userAgent: parts[1],
  };
};

export const extractEmailFromCookie = (cookie: string): string | null => {
  const match = cookie.match(/email=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return null;
};

export const sanitizeCookieForExtension = (cookie: string): string => {
  return cookie.replace(/\n/g, '').replace(/\r/g, '').trim();
};