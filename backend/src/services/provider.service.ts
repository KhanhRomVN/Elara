import fetch from 'node-fetch'; // Ensure fetch is available
import { createLogger } from '../utils/logger';

const logger = createLogger('ProviderService');

export interface Provider {
  id: string;
  name: string;
  is_enabled: boolean;
}

const PROVIDERS_URL =
  'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/provider.json';

// Cache for remote provider config
// Structure: [ { provider_id: string, provider_name: string, is_enabled: boolean } ]
let cachedConfig: any[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

const fetchProviderConfig = async (): Promise<any[]> => {
  if (cachedConfig && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedConfig;
  }

  try {
    const response = await fetch(PROVIDERS_URL);
    if (!response.ok) {
      logger.error(`Failed to fetch providers config: ${response.statusText}`);
      return cachedConfig || [];
    }
    const data: any = await response.json();

    let parsedConfig: any[] = [];

    if (Array.isArray(data)) {
      parsedConfig = data;
    } else if (typeof data === 'object' && data !== null && data.data) {
      parsedConfig = data.data; // Fallback just in case
    }

    cachedConfig = parsedConfig;
    cacheTime = Date.now();
    return cachedConfig || [];
  } catch (error) {
    logger.error('Error fetching providers config from GitHub', error);
    return cachedConfig || [];
  }
};

export const getAllProviders = async (): Promise<Provider[]> => {
  // Get dynamic status from remote
  const remoteConfig = await fetchProviderConfig();

  return remoteConfig.map((c: any) => ({
    id: c.provider_id,
    name: c.provider_name,
    is_enabled: c.is_enabled,
  }));
};

export const getProviderModels = async (
  providerId: string,
): Promise<{ id: string; name: string }[]> => {
  // Check if provider is enabled first
  const isEnabled = await isProviderEnabled(providerId);
  if (!isEnabled) {
    throw new Error(`Provider ${providerId} is disabled`);
  }

  // The new provider.json does not contain models information.
  // Returning empty array as per new configuration structure.
  return [];
};

export const isProviderEnabled = async (
  providerId: string,
): Promise<boolean> => {
  const remoteConfig = await fetchProviderConfig();
  const config = remoteConfig.find((c: any) => c.provider_id === providerId);
  return config ? config.is_enabled : false;
};
