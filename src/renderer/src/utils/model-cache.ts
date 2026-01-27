import { getApiBaseUrl } from './apiUrl';

/**
 * Model Cache Utility
 *
 * Provides centralized caching for AI provider model lists with:
 * - Cache-first loading strategy
 * - Background sync mechanism
 * - Per-provider caching with timestamps
 * - Unified API endpoint for all providers
 */

export interface Model {
  id: string;
  name?: string;
  description?: string;
  [key: string]: any;
}

interface CachedModelData {
  models: Model[];
  timestamp: number;
  providerId: string;
}

const CACHE_PREFIX = 'model-cache-';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const SYNC_INTERVAL = 1000 * 60 * 5; // 5 minutes

let syncIntervalId: NodeJS.Timeout | null = null;
let currentAccounts: any[] = [];
let currentPort: number = 11434;

/**
 * Get cached models for a provider
 */
export function getCachedModels(providerId: string): Model[] | null {
  try {
    const cacheKey = `${CACHE_PREFIX}${providerId}`;
    const cached = localStorage.getItem(cacheKey);

    if (!cached) return null;

    const data: CachedModelData = JSON.parse(cached);

    // Check if cache is still valid (within CACHE_DURATION)
    const age = Date.now() - data.timestamp;
    if (age > CACHE_DURATION) {
      return null; // Expired
    }

    return data.models;
  } catch (error) {
    console.error(`Error reading cache for ${providerId}:`, error);
    return null;
  }
}

/**
 * Set cached models for a provider
 */
export function setCachedModels(providerId: string, models: Model[]): void {
  try {
    const cacheKey = `${CACHE_PREFIX}${providerId}`;
    const data: CachedModelData = {
      models,
      timestamp: Date.now(),
      providerId,
    };
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (error) {
    console.error(`Error caching models for ${providerId}:`, error);
  }
}

/**
 * Clear cache for a specific provider
 */
export function clearCachedModels(providerId: string): void {
  try {
    const cacheKey = `${CACHE_PREFIX}${providerId}`;
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.error(`Error clearing cache for ${providerId}:`, error);
  }
}

/**
 * Clear all model caches
 */
export function clearAllModelCaches(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing all model caches:', error);
  }
}

/**
 * Fetch models from unified API endpoint
 */
async function fetchModelsFromAPI(providerId: string, port: number): Promise<Model[]> {
  try {
    const normalizedProviderId = providerId.toLowerCase();

    // Use unified endpoint for all providers
    const baseUrl = getApiBaseUrl(port);
    const endpoint = `${baseUrl}/v1/providers/${normalizedProviderId}/models`;

    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch models');
    }

    // Parse response
    const models: Model[] = (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      is_thinking: m.is_thinking,
      ...m,
    }));

    console.log(`[Model Cache] Fetched ${models.length} models for ${providerId}`, models);
    return models;
  } catch (error) {
    console.error(`[Model Cache] Error fetching models for ${providerId}:`, error);
    return [];
  }
}

/**
 * Fetch and cache models for a provider
 * Returns cached models if available, then fetches in background
 */
export async function fetchAndCacheModels(
  providerId: string,
  _email: string, // Kept for backward compatibility but not used
  port: number,
): Promise<Model[]> {
  // Try cache first
  const cached = getCachedModels(providerId);

  // Fetch from API
  const models = await fetchModelsFromAPI(providerId, port);

  // Update cache if we got models
  if (models.length > 0) {
    setCachedModels(providerId, models);
    return models;
  }

  // Fall back to cache if fetch failed
  return cached || [];
}

/**
 * Background sync function
 */
async function performBackgroundSync(): Promise<void> {
  if (currentAccounts.length === 0) return;

  console.log('[Model Cache] Running background sync...');

  // Group accounts by provider
  const providerAccounts = new Map<string, any>();

  currentAccounts.forEach((account) => {
    if (account.status === 'Active' && !providerAccounts.has(account.provider)) {
      providerAccounts.set(account.provider, account);
    }
  });

  // Sync models for each provider
  const syncPromises = Array.from(providerAccounts.entries()).map(async ([providerId]) => {
    try {
      const models = await fetchModelsFromAPI(providerId, currentPort);
      if (models.length > 0) {
        setCachedModels(providerId, models);
        console.log(`[Model Cache] Synced ${models.length} models for ${providerId}`);
      }
    } catch (error) {
      console.error(`[Model Cache] Sync failed for ${providerId}:`, error);
    }
  });

  await Promise.all(syncPromises);
}

/**
 * Start background sync
 */
export function startBackgroundSync(accounts: any[], port: number): void {
  // Stop existing sync if running
  stopBackgroundSync();

  // Update current state
  currentAccounts = accounts;
  currentPort = port;

  // Start periodic sync
  syncIntervalId = setInterval(() => {
    performBackgroundSync();
  }, SYNC_INTERVAL);

  console.log('[Model Cache] Background sync started');
}

/**
 * Stop background sync
 */
export function stopBackgroundSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[Model Cache] Background sync stopped');
  }
}

/**
 * Get first available model ID from cache or fetch
 */
export async function getDefaultModelId(
  providerId: string,
  email?: string,
  port?: number,
): Promise<string | null> {
  // Try cache first
  const cached = getCachedModels(providerId);
  if (cached && cached.length > 0) {
    return cached[0].id;
  }

  // If port provided, try fetching
  if (port) {
    const models = await fetchAndCacheModels(providerId, email || '', port);
    if (models.length > 0) {
      return models[0].id;
    }
  }

  return null;
}
