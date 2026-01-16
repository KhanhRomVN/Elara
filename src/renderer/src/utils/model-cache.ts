/**
 * Model Cache Utility
 *
 * Provides centralized caching for AI provider model lists with:
 * - Cache-first loading strategy
 * - Background sync mechanism
 * - Per-provider caching with timestamps
 * - Static model lists for providers without APIs
 */

import { hasStaticModels, getStaticModels } from '../config/static-models';

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
 * Fetch models from API for a specific provider
 */
async function fetchModelsFromAPI(
  providerId: string,
  email: string,
  port: number,
): Promise<Model[]> {
  // Check if provider has static models (no API)
  if (hasStaticModels(providerId)) {
    console.log(`[Model Cache] Using static models for ${providerId}`);
    return getStaticModels(providerId);
  }

  try {
    let endpoint = '';

    // Map provider IDs to their API endpoints (only for providers with dynamic APIs)
    switch (providerId) {
      case 'Groq':
        endpoint = `http://localhost:${port}/v1/groq/models?email=${encodeURIComponent(email)}`;
        break;
      case 'Antigravity':
        endpoint = `http://localhost:${port}/v1/antigravity/models?email=${encodeURIComponent(email)}`;
        break;
      case 'HuggingChat':
        endpoint = `http://localhost:${port}/v1/huggingchat/models?email=${encodeURIComponent(email)}`;
        break;
      case 'LMArena':
        endpoint = `http://localhost:${port}/v1/lmarena/models?email=${encodeURIComponent(email)}`;
        break;
      case 'StepFun':
        endpoint = `http://localhost:${port}/v1/stepfun/models?email=${encodeURIComponent(email)}`;
        break;
      default:
        console.warn(`No API endpoint defined for provider: ${providerId}`);
        return [];
    }

    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Parse response based on provider format
    let models: Model[] = [];

    if (providerId === 'Groq' || providerId === 'LMArena') {
      models = (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        ...m,
      }));
    } else if (providerId === 'Antigravity') {
      if (data.models) {
        if (Array.isArray(data.models)) {
          models = data.models.map((m: any) => ({
            id: m.id || m.name,
            name: m.name || m.id,
            ...m,
          }));
        } else {
          models = Object.values(data.models).map((m: any) => ({
            id: m.id || m.name,
            name: m.name || m.id,
            ...m,
          }));
        }
      }
    } else if (Array.isArray(data)) {
      models = data.map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        ...m,
      }));
    } else if (data.data && Array.isArray(data.data)) {
      models = data.data.map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        ...m,
      }));
    }

    return models;
  } catch (error) {
    console.error(`Error fetching models for ${providerId}:`, error);
    return [];
  }
}

/**
 * Fetch and cache models for a provider
 * Returns cached models if available, then fetches in background
 */
export async function fetchAndCacheModels(
  providerId: string,
  email: string,
  port: number,
): Promise<Model[]> {
  // Try cache first
  const cached = getCachedModels(providerId);

  // Fetch from API
  const models = await fetchModelsFromAPI(providerId, email, port);

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
  const syncPromises = Array.from(providerAccounts.entries()).map(async ([providerId, account]) => {
    try {
      const models = await fetchModelsFromAPI(providerId, account.email, currentPort);
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

  // If email and port provided, try fetching
  if (email && port) {
    const models = await fetchAndCacheModels(providerId, email, port);
    if (models.length > 0) {
      return models[0].id;
    }
  }

  return null;
}
