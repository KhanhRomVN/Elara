/**
 * Static Model Lists
 *
 * This file contains hardcoded model lists for providers that don't have
 * API endpoints to fetch their available models dynamically.
 *
 * Providers with static lists:
 * - DeepSeek
 * - Claude
 * - Mistral
 * - Kimi
 * - Qwen
 * - Cohere
 * - Perplexity
 */

export interface StaticModel {
  id: string;
  name: string;
}

/**
 * Static model lists for each provider
 */
export const STATIC_MODELS: Record<string, StaticModel[]> = {
  DeepSeek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
  ],

  Claude: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  ],
};

/**
 * Check if a provider has static models (no API endpoint)
 */
export function hasStaticModels(providerId: string): boolean {
  return providerId in STATIC_MODELS;
}

/**
 * Get static models for a provider
 */
export function getStaticModels(providerId: string): StaticModel[] {
  return STATIC_MODELS[providerId] || [];
}
