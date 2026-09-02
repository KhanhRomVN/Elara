/**
 * ------------------------------------------------------------------
 * Claude Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Claude provider.
 *
 * Main exports:
 * - BASE_URL        : Base URL của Claude AI
 * - CLAUDE_EVENTS   : Các event name dùng trong proxy handler
 * - USER_AGENT      : User-Agent string dùng chung
 * ------------------------------------------------------------------
 */

export const BASE_URL = 'https://claude.ai';

export const CLAUDE_EVENTS = {
  AUTH_HEADER: 'claude-auth-header',
  LOGIN_EMAIL: 'claude-login-email',
  LOGIN_TOKEN: 'claude-login-token',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

export const GOOGLE_OAUTH_LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?service=lso&passive=1209600&continue=https://claude.ai/login';

export const API_PATHS = {
  PROFILE: '/api/auth/me',
  CHAT: '/api/chat',
} as const;