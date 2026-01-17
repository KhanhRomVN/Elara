import { getDb } from './db';
import fetch from 'node-fetch'; // Ensure fetch is available
import { createLogger } from '../utils/logger';

const logger = createLogger('ProviderService');

export interface Provider {
  id: string;
  name: string;
  is_enabled: boolean;
}

const MODELS_URL =
  'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/models.json';

// Cache for remote provider config
// Structure: [ { provider_id: string, is_enabled: boolean } ]
let cachedConfig: any[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

const fetchProviderConfig = async (): Promise<any[]> => {
  if (cachedConfig && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedConfig;
  }

  try {
    const response = await fetch(MODELS_URL);
    if (!response.ok) {
      logger.error(`Failed to fetch models config: ${response.statusText}`);
      return cachedConfig || [];
    }
    const data: any = await response.json();

    let parsedConfig: any[] = [];

    if (Array.isArray(data)) {
      parsedConfig = data;
    } else if (typeof data === 'object' && data !== null) {
      // Check for map format: { "providerId": [models] }
      // We assume if it's an object and values are arrays, it's the map format
      const values = Object.values(data);
      if (values.length > 0 && Array.isArray(values[0])) {
        parsedConfig = Object.entries(data).map(([providerId, models]) => ({
          provider_id: providerId,
          is_enabled: true,
          models: models,
        }));
      } else {
        // Fallback for { data: [...] } or { models: [...] } wrappers
        parsedConfig = data.data || data.models || [];
      }
    }

    cachedConfig = parsedConfig;
    cacheTime = Date.now();
    return cachedConfig || [];
  } catch (error) {
    logger.error('Error fetching models config from GitHub', error);
    return cachedConfig || [];
  }
};

export const getAllProviders = async (): Promise<Provider[]> => {
  const db = getDb();

  // Get static providers from DB
  const dbProviders: any[] = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM providers', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // Get dynamic status from remote
  const remoteConfig = await fetchProviderConfig();

  return dbProviders.map((p) => {
    const config = remoteConfig.find((c: any) => c.provider_id === p.id);
    return {
      id: p.id,
      name: p.name,
      // Default to false if not found in remote config, or use remote status
      is_enabled: config ? config.is_enabled : false,
    };
  });
};

export const getProviderModels = async (
  providerId: string,
): Promise<{ id: string; name: string }[]> => {
  // Check if provider is enabled first
  const isEnabled = await isProviderEnabled(providerId);
  if (!isEnabled) {
    throw new Error(`Provider ${providerId} is disabled`);
  }

  const remoteConfig = await fetchProviderConfig();
  const config = remoteConfig.find((c: any) => c.provider_id === providerId);

  return config?.models || [];
};

export const isProviderEnabled = async (
  providerId: string,
): Promise<boolean> => {
  const remoteConfig = await fetchProviderConfig();
  const config = remoteConfig.find((c: any) => c.provider_id === providerId);
  return config ? config.is_enabled : false;
};
