/**
 * ------------------------------------------------------------------
 * Qwen CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Qwen CLI provider.
 *
 * Main exports:
 * - QWEN_CLI_EVENTS         : Các event name dùng trong proxy handler
 * - CHAT_QWEN_BASE_URL      : Base URL của chat.qwen.ai
 * - PORTAL_QWEN_BASE_URL    : Base URL của portal.qwen.ai
 * - USER_INFO_URL           : URL lấy thông tin user
 * - CHAT_COMPLETIONS_URL    : URL chat completion
 * ------------------------------------------------------------------
 */

export const QWEN_CLI_EVENTS = {
  TOKENS: 'qwen-cli-tokens',
  USER_INFO: 'qwen-cli-user-info',
} as const;

export const CHAT_QWEN_BASE_URL = 'https://chat.qwen.ai';
export const PORTAL_QWEN_BASE_URL = 'https://portal.qwen.ai';

export const USER_INFO_URL = `${CHAT_QWEN_BASE_URL}/api/v1/user/info`;
export const CHAT_COMPLETIONS_URL = `${PORTAL_QWEN_BASE_URL}/v1/chat/completions`;