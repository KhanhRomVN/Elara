/**
 * ------------------------------------------------------------------
 * Qwen Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Qwen provider.
 *
 * Main exports:
 * - BASE_URL    : Base URL của Qwen chat
 * - QWEN_EVENTS : Các event name dùng trong proxy handler
 * - USER_AGENT  : User-Agent string dùng chung
 * ------------------------------------------------------------------
 */

export const BASE_URL = 'https://chat.qwen.ai';

export const QWEN_EVENTS = {
  COOKIES: 'qwen-cookies',
  HEADERS: 'qwen-headers',
  LOGIN_TOKEN: 'qwen-login-token',
  LOGIN_EMAIL: 'qwen-login-email',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';