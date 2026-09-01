/**
 * ------------------------------------------------------------------
 * Kimi Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Kimi provider.
 *
 * Main exports:
 * - KIMI_BASE_URL          : Base URL của Kimi AI
 * - KIMI_MODELS            : Model constants
 * - KIMI_EVENTS            : Các event name dùng trong proxy handler
 * - USER_AGENT             : User-Agent string dùng chung
 * - MSH_HEADERS            : Các header MSH dùng chung
 * - AUTH_REFRESH_URL       : URL refresh token
 * - CHAT_URL               : URL chat completion
 * - GET_USER_URL           : URL lấy thông tin user
 * - LIST_THIRD_ACCOUNTS_URL: URL lấy third-party accounts
 * ------------------------------------------------------------------
 */

export const KIMI_BASE_URL = 'https://www.kimi.ai';

export const KIMI_MODELS = {
  K3: 'k3',
  K3_SWARM: 'k3-swarm',
  INSTANT: 'instant',
  K2D6_THINKING: 'k2d6-thinking',
  K2D6: 'k2d6',
  K2D6_AGENT: 'k2d6-agent',
  K2D6_AGENT_ULTRA: 'k2d6-agent-ultra',
  KIMI_LATEST: 'kimi-latest',
} as const;

export type KimiModel = (typeof KIMI_MODELS)[keyof typeof KIMI_MODELS];

export const KIMI_EVENTS = {
  HEADERS: 'kimi-headers',
  LOGIN_TOKEN: 'kimi-login-token',
  LOGIN_EMAIL: 'kimi-login-email',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const MSH_HEADERS = {
  'x-msh-platform': 'web',
  'x-msh-version': '2.0.0',
  'x-language': 'en-US',
} as const;

export const AUTH_REFRESH_URL =
  'https://auth.kimi.ai/api/account.gateway.v1.AuthService/RefreshToken';
export const CHAT_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`;
export const GET_USER_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.account.v1.UserService/GetCurrentUser`;
export const LIST_THIRD_ACCOUNTS_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.account.v1.SecurityService/ListThirdAccounts`;