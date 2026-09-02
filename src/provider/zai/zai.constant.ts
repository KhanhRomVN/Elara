/**
 * ------------------------------------------------------------------
 * Z.AI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Z.AI provider.
 *
 * Main exports:
 * - BASE_URL            : Base URL của Z.AI chat
 * - ZAI_EVENTS          : Các event name dùng trong proxy handler
 * - DEFAULT_USER_AGENT  : User-Agent mặc định
 * - SALT                : Salt cho signature generation
 * - FE_VERSION          : Frontend version header
 * ------------------------------------------------------------------
 */

export const BASE_URL = 'https://chat.z.ai';

export const ZAI_EVENTS = {
  TOKEN: 'zai-token',
  LOGIN_EMAIL: 'zai-login-email',
} as const;

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const SALT = 'key-@@@@)))()((9))-xxxx&&&%%%%%';

export const FE_VERSION = 'prod-fe-1.1.35';