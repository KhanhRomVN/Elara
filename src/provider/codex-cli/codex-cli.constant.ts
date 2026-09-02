/**
 * ------------------------------------------------------------------
 * Codex CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Codex CLI provider.
 *
 * Main exports:
 * - CODEX_CLI_EVENTS    : Các event name dùng trong proxy handler
 * - CHATGPT_USAGE_URL   : URL lấy thông tin usage
 * - CODEX_RESPONSES_URL : URL chat completion
 * - AUTH_TOKEN_URL      : URL refresh token
 * - USER_AGENT          : User-Agent string dùng chung
 * - CLIENT_ID           : Client ID cho OAuth refresh
 * - ORIGINATOR          : Originator header
 * - DEFAULT_INSTRUCTIONS: System instructions mặc định
 * ------------------------------------------------------------------
 */

export const CODEX_CLI_EVENTS = {
  TOKENS: 'codex-cli-tokens',
  USER_INFO: 'codex-cli-user-info',
} as const;

export const CHATGPT_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
export const CODEX_RESPONSES_URL =
  'https://chatgpt.com/backend-api/codex/responses';
export const AUTH_TOKEN_URL = 'https://auth.openai.com/oauth/token';

export const USER_AGENT =
  'codex_cli_rs/0.104.0 (Ubuntu 24.4.0; x86_64) gnome-terminal';

export const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const ORIGINATOR = 'codex_cli_rs';
export const DEFAULT_INSTRUCTIONS = 'You are Codex, a GPT-5 coding agent.';