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

  Mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large' },
    { id: 'mistral-medium-latest', name: 'Mistral Medium' },
    { id: 'mistral-small-latest', name: 'Mistral Small' },
  ],

  Kimi: [
    { id: 'moonshot-v1-8k', name: 'Kimi 8K' },
    { id: 'moonshot-v1-32k', name: 'Kimi 32K' },
    { id: 'moonshot-v1-128k', name: 'Kimi 128K' },
  ],

  Qwen: [
    { id: 'qwen-max', name: 'Qwen Max' },
    { id: 'qwen-plus', name: 'Qwen Plus' },
    { id: 'qwen-turbo', name: 'Qwen Turbo' },
  ],

  Cohere: [
    { id: 'command-r-plus', name: 'Command R+' },
    { id: 'command-r', name: 'Command R' },
    { id: 'command', name: 'Command' },
    { id: 'command-light', name: 'Command Light' },
  ],

  Perplexity: [
    { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large Online' },
    { id: 'llama-3.1-sonar-small-128k-online', name: 'Sonar Small Online' },
    { id: 'llama-3.1-sonar-large-128k-chat', name: 'Sonar Large Chat' },
    { id: 'llama-3.1-sonar-small-128k-chat', name: 'Sonar Small Chat' },
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
