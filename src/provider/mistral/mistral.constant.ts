/**
 * ------------------------------------------------------------------
 * Mistral Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Mistral provider.
 *
 * Main exports:
 * - BASE_URL       : Base URL của Mistral console
 * - CHAT_BASE_URL  : Base URL của Mistral chat
 * - AUTH_LOGIN_URL : URL login
 * - MISTRAL_EVENTS : Các event name dùng trong proxy handler
 * ------------------------------------------------------------------
 */

export const BASE_URL = 'https://console.mistral.ai';
export const CHAT_BASE_URL = 'https://chat.mistral.ai';
export const AUTH_LOGIN_URL = 'https://auth.mistral.ai/ui/login';

export const MISTRAL_EVENTS = {
  COOKIES: 'mistral-cookies',
} as const;