/**
 * Provider Registry Service
 * Centralized service for managing provider configurations.
 * Fetches provider data from backend API.
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { getProxyConfig } from './config';

export interface ProviderModel {
  id: string;
  name: string;
  is_thinking?: boolean;
}

export interface Provider {
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  website?: string;
  is_search?: boolean;
  is_upload?: boolean;
  models?: ProviderModel[];
  [key: string]: any;
}

// Cache for provider data
let cachedProviders: Provider[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// Backend API URL
const getBackendApiUrl = () => {
  try {
    const { getProxyConfig } = require('./config');
    const config = getProxyConfig();
    return `http://localhost:${config.port}`;
  } catch (e) {
    return process.env.BACKEND_API_URL || 'http://localhost:11434';
  }
};

/**
 * Fetch providers from backend API
 */
async function fetchProvidersFromApi(): Promise<Provider[]> {
  try {
    const baseUrl = getBackendApiUrl();
    const response = await fetch(`${baseUrl}/v1/providers`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const providers = await response.json();
    return Array.isArray(providers) ? providers : [];
  } catch (error) {
    console.error('[ProviderRegistry] Failed to fetch from backend API:', error);
    throw error;
  }
}

/**
 * Get all providers with caching
 * Uses backend API as primary source, local file as fallback
 */
export async function getProviders(): Promise<Provider[]> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedProviders && now - lastFetchTime < CACHE_TTL) {
    return cachedProviders;
  }

  // Try backend API first
  try {
    const baseUrl = getBackendApiUrl();
    const currentPort = getProxyConfig().port;
    const isSelfFetch = baseUrl.includes(`:${currentPort}`);

    if (isSelfFetch) {
      console.log('[ProviderRegistry] Skipping self-fetch to avoid infinite loop');
    } else {
      const providers = await fetchProvidersFromApi();
      cachedProviders = providers;
      lastFetchTime = now;
      console.log(
        `[ProviderRegistry] Loaded ${providers.length} providers from backend API (${baseUrl})`,
      );
      return providers;
    }
  } catch (error) {
    console.warn('[ProviderRegistry] Failed to fetch from backend API, trying local file');
  }

  // Fallback to local file / Remote Sync
  try {
    const GITHUB_PROVIDER_URL =
      'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/provider.json';
    const cachePath = path.join(app.getPath('userData'), 'provider.json');

    // 1. Try to fetch from Remote first (Flexible update)
    try {
      console.log('[ProviderRegistry] Fetching flexible provider.json from GitHub...');
      const response = await fetch(GITHUB_PROVIDER_URL);
      if (response.ok) {
        const remoteData = await response.json();
        // Update local cache
        fs.writeFileSync(cachePath, JSON.stringify(remoteData, null, 2));
        cachedProviders = remoteData;
        lastFetchTime = now;
        console.log(
          `[ProviderRegistry] Successfully updated providers from remote. Items: ${remoteData.length}`,
        );
        return remoteData;
      }
    } catch (e) {
      console.warn('[ProviderRegistry] Remote fetch failed, looking for cache/local');
    }

    // 2. Try Cache from userData
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, 'utf-8');
      const providers = JSON.parse(data);
      cachedProviders = providers;
      lastFetchTime = now;
      console.log(`[ProviderRegistry] Loaded providers from cache: ${cachePath}`);
      return providers;
    }

    // 3. Fallback to bundled resource (Original seed)
    let localPath = '';
    if (app.isPackaged) {
      localPath = path.join(process.resourcesPath, 'resources', 'provider.json');
      if (!fs.existsSync(localPath)) {
        localPath = path.join(app.getAppPath(), '..', 'resources', 'provider.json');
      }
    } else {
      localPath = path.resolve(process.cwd(), 'resources', 'provider.json');
    }

    if (fs.existsSync(localPath)) {
      const data = fs.readFileSync(localPath, 'utf-8');
      const providers = JSON.parse(data);
      cachedProviders = providers;
      lastFetchTime = now;
      console.log(`[ProviderRegistry] Loaded providers from original seed: ${localPath}`);
      return providers;
    } else {
      console.warn(`[ProviderRegistry] Provider file not found at local paths.`);
    }
  } catch (e) {
    console.error('[ProviderRegistry] Critical error in provider loading:', e);
  }

  // Return stale cache if available
  if (cachedProviders) {
    console.warn('[ProviderRegistry] Using stale cache');
    return cachedProviders;
  }

  return [];
}

/**
 * Get a provider by ID (case-insensitive)
 */
export async function getProviderById(providerId: string): Promise<Provider | null> {
  const providers = await getProviders();
  const normalizedId = providerId.toLowerCase();
  return providers.find((p) => p.provider_id.toLowerCase() === normalizedId) || null;
}

/**
 * Check if a provider is enabled
 */
export async function isProviderEnabled(providerId: string): Promise<boolean> {
  const provider = await getProviderById(providerId);
  return provider?.is_enabled ?? false;
}

/**
 * Get static models for a provider (if defined in provider.json)
 */
export async function getProviderStaticModels(providerId: string): Promise<ProviderModel[] | null> {
  const provider = await getProviderById(providerId);
  return provider?.models || null;
}

/**
 * Get all enabled providers
 */
export async function getEnabledProviders(): Promise<Provider[]> {
  const providers = await getProviders();
  return providers.filter((p) => p.is_enabled);
}

/**
 * Get list of all provider IDs
 */
export async function getAllProviderIds(): Promise<string[]> {
  const providers = await getProviders();
  return providers.map((p) => p.provider_id);
}

/**
 * Force refresh the provider cache
 */
export function invalidateProviderCache(): void {
  cachedProviders = null;
  lastFetchTime = 0;
}
