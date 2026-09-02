/**
 * ------------------------------------------------------------------
 * DeepSeek Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho DeepSeek provider.
 *
 * Main exports:
 * - BASE_URL            : Base URL của DeepSeek API
 * - DEEPSEEK_EVENTS     : Các event name dùng trong proxy handler
 * - MAX_CONTINUATIONS   : Số lần auto-continue tối đa
 * ------------------------------------------------------------------
 */

export const BASE_URL = 'https://chat.deepseek.com';

export const DEEPSEEK_EVENTS = {
  AUTH_HEADER: 'deepseek-auth-header',
  LOGIN_EMAIL: 'deepseek-login-email',
  LOGIN_TOKEN: 'deepseek-login-token',
  GOOGLE_EMAIL: 'deepseek-google-email',
  USER_INFO: 'deepseek-user-info',
} as const;

export const MAX_CONTINUATIONS = 10;

export const GOOGLE_OAUTH_LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?service=lso&passive=1209600&continue=https://chat.deepseek.com/login';
