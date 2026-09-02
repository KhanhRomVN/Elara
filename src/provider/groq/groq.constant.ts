/**
 * ------------------------------------------------------------------
 * Groq Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Groq provider.
 *
 * Main exports:
 * - BASE_URL                  : Base URL của Groq console
 * - API_BASE_URL              : Base URL của Groq API
 * - API_CHAT_COMPLETIONS_URL  : URL chat completion
 * - API_MODELS_URL            : URL lấy danh sách models
 * - SESSION_COOKIE_NAME       : Tên session cookie
 * - GROQ_EVENTS               : Các event name dùng trong proxy handler
 * ------------------------------------------------------------------
 */

export const BASE_URL = 'https://console.groq.com';
export const API_BASE_URL = 'https://api.groq.com';

export const API_CHAT_COMPLETIONS_URL = `${API_BASE_URL}/openai/v1/chat/completions`;
export const API_MODELS_URL = `${API_BASE_URL}/internal/v1/models`;

export const SESSION_COOKIE_NAME = 'stytch_session_jwt';

export const GROQ_EVENTS = {
  COOKIES: 'groq-cookies',
} as const;