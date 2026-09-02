/**
 * ------------------------------------------------------------------
 * Gemini Types
 * ------------------------------------------------------------------
 * Type definitions cho Gemini Web API.
 *
 * Main exports:
 * - GeminiCredential : Credential structure với cookie, sapisid, xsrf, authUser
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface GeminiCredential {
  cookie: string;
  sapisid?: string;
  authUser?: string;
  xsrfToken?: string;
  email?: string;
}