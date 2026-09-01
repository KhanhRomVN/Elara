/**
 * ------------------------------------------------------------------
 * HuggingChat Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho HuggingChat provider.
 *
 * Main exports:
 * - BASE_URL           : Base URL của Hugging Face
 * - HUGGINGCHAT_EVENTS : Các event name dùng trong proxy handler
 * - USER_AGENT         : User-Agent string dùng chung
 * ------------------------------------------------------------------
 */

export const BASE_URL = 'https://huggingface.co';

export const HUGGINGCHAT_EVENTS = {
  COOKIES: 'hugging-chat-cookies',
  LOGIN_DATA: 'hugging-chat-login-data',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';