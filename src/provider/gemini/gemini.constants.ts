/**
 * ------------------------------------------------------------------
 * Gemini Constants
 * ------------------------------------------------------------------
 * Constants cho Gemini Web API.
 *
 * Main exports:
 * - BASE_URL       : Base URL cho Gemini
 * - GEMINI_BL      : Build label (bl parameter)
 * - MODEL_MAP      : Mapping từ model name sang mode và think level
 * ------------------------------------------------------------------
 */

// ─── Constants ──────────────────────────────────────────────────────────

export const BASE_URL = 'https://gemini.google.com';

// Gemini Web build label — may need periodic update
export const GEMINI_BL = 'boq_assistant-bard-web-server_20260525.09_p0';

// Model mapping: MODE_CATEGORY enum from Gemini frontend JS source
// 1=FAST, 2=THINKING, 3=PRO, 4=AUTO, 5=FAST_DYNAMIC_THINKING, 6=FLASH_LITE
export const MODEL_MAP: Record<
  string,
  { mode: number; think: number; desc: string }
> = {
  'gemini-3.5-flash': {
    mode: 1,
    think: 4,
    desc: 'Fast general-purpose model',
  },
  'gemini-3.5-flash-thinking': {
    mode: 2,
    think: 0,
    desc: 'Deep thinking mode, longest output (~20k chars)',
  },
  'gemini-3.1-pro': {
    mode: 3,
    think: 4,
    desc: 'Pro model (requires cookie for real routing)',
  },
  'gemini-auto': { mode: 4, think: 4, desc: 'Auto model selection' },
  'gemini-3.5-flash-thinking-lite': {
    mode: 5,
    think: 0,
    desc: 'Dynamic thinking with adaptive depth',
  },
  'gemini-flash-lite': { mode: 6, think: 4, desc: 'Lightweight fast model' },
};