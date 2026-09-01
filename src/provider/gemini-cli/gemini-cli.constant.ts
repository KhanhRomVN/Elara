/**
 * ------------------------------------------------------------------
 * Gemini CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Gemini CLI provider.
 *
 * Main exports:
 * - GEMINI_CLI_EVENTS              : Các event name dùng trong proxy handler
 * - CLOUDCODE_BASE_URL             : Base URL của Cloud Code API
 * - CLOUDCODE_LOAD_CODE_ASSIST_URL : URL lấy project ID
 * - CLOUDCODE_STREAM_GENERATE_URL  : URL chat completion streaming
 * - CLOUDCODE_RETRIEVE_QUOTA_URL   : URL lấy danh sách models
 * - USER_AGENT                     : User-Agent string dùng chung
 * - X_GOOG_API_CLIENT              : Google API client version
 * - CLIENT_METADATA                : Metadata cho loadCodeAssist
 * - DEFAULT_PROJECT_ID             : Fallback project ID
 * ------------------------------------------------------------------
 */

export const GEMINI_CLI_EVENTS = {
  TOKENS: 'gemini-cli-tokens',
  USER_INFO: 'gemini-cli-user-info',
} as const;

export const CLOUDCODE_BASE_URL =
  'https://cloudcode-pa.googleapis.com/v1internal';
export const CLOUDCODE_LOAD_CODE_ASSIST_URL = `${CLOUDCODE_BASE_URL}:loadCodeAssist`;
export const CLOUDCODE_STREAM_GENERATE_URL = `${CLOUDCODE_BASE_URL}:streamGenerateContent?alt=sse`;
export const CLOUDCODE_RETRIEVE_QUOTA_URL = `${CLOUDCODE_BASE_URL}:retrieveUserQuota`;

export const USER_AGENT =
  'GeminiCLI/0.29.7/gemini-3-pro-preview (linux; x64) google-api-nodejs-client/9.15.1';
export const X_GOOG_API_CLIENT = 'gl-node/22.21.1';

export const CLIENT_METADATA = { ideType: 9, platform: 3, pluginType: 2 };
export const DEFAULT_PROJECT_ID = 'reference-courage-zzsgc';