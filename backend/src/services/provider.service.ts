import fetch from 'node-fetch';
import { createLogger } from '../utils/logger';
import { providerRegistry } from '../provider/registry';
import { getDb } from './db';

const logger = createLogger('ProviderService');

export interface Provider {
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  website?: string;
  is_search?: boolean;
  is_upload?: boolean;
  is_temperature?: boolean;
  auth_method?: string[];
  models?: {
    id: string;
    name: string;
    is_thinking?: boolean;
    context_length?: number | null;
  }[];
}

const PROVIDERS_URL =
  'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/provider.json';

// Cache for remote provider config
// Structure: [ { provider_id: string, provider_name: string, is_enabled: boolean, is_search?: boolean, is_upload?: boolean } ]
let cachedConfig: any[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 1000 * 60; // 1 minute (reduced for development)

const fetchProviderConfig = async (forceRefresh = false): Promise<any[]> => {
  if (
    !forceRefresh &&
    cachedConfig &&
    cachedConfig.length > 0 &&
    Date.now() - cacheTime < CACHE_DURATION
  ) {
    return cachedConfig;
  }

  const tryFetch = async (): Promise<any[]> => {
    // 1. Local Fallback (Preferred for development)
    try {
      const fs = require('fs');
      const path = require('path');
      const possiblePaths = [
        path.join(process.cwd(), 'provider.json'),
        path.join(process.cwd(), 'resources', 'provider.json'),
        path.join(__dirname, '../../../../resources', 'provider.json'),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const data = fs.readFileSync(p, 'utf-8');
          const parsed = JSON.parse(data);
          const config = Array.isArray(parsed) ? parsed : parsed.data || [];
          if (config.length > 0) {
            logger.info(`Loaded providers from local file: ${p}`);
            return config;
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load local provider.json', error);
    }

    // 2. Try GitHub (Remote)
    try {
      const response = await fetch(PROVIDERS_URL);
      if (response.ok) {
        const data: any = await response.json();
        let parsed: any[] = [];
        if (Array.isArray(data)) parsed = data;
        else if (data && data.data) parsed = data.data;

        if (parsed.length > 0) {
          logger.info('Loaded providers from GitHub');
          return parsed;
        }
      } else {
        logger.error(`GitHub fetch failed: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error fetching from GitHub', error);
    }

    return [];
  };

  let result = await tryFetch();

  // If still empty and not forcing refresh, try forcing refresh
  if (result.length === 0 && !forceRefresh) {
    logger.info('Provider list is empty, retrying fetch...');
    result = await tryFetch();
  }

  // Sanitize: Remove legacy id and name fields if they exist in the source JSON
  const sanitized = result.map((p: any) => {
    const { id, name, ...rest } = p;
    return rest;
  });

  cachedConfig = sanitized;
  cacheTime = Date.now();
  return sanitized;
};

export const getAllProviders = async (): Promise<Provider[]> => {
  return await fetchProviderConfig();
};

export const getProviderModels = async (
  providerId: string,
): Promise<
  {
    id: string;
    name: string;
    is_thinking?: boolean;
    context_length?: number | null;
  }[]
> => {
  // Check if provider is enabled first
  const isEnabled = await isProviderEnabled(providerId);
  if (!isEnabled) {
    throw new Error(`Provider ${providerId} is disabled`);
  }

  // Fetch remote config to get models
  const remoteConfig = await fetchProviderConfig();
  const provider = remoteConfig.find((c: any) => c.provider_id === providerId);

  if (provider && provider.models && Array.isArray(provider.models)) {
    return provider.models.map((m: any) => ({
      id: m.id,
      name: m.name,
      is_thinking: m.is_thinking || false,
      context_length: m.context_length !== undefined ? m.context_length : null,
    }));
  }

  // Fallback to dynamic provider if available
  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (dynamicProvider && dynamicProvider.getModels) {
    logger.info(`Fetching dynamic models for ${providerId} from registry...`);
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE LOWER(provider_id) = ? LIMIT 1')
      .get(providerId.toLowerCase()) as any;

    if (account) {
      try {
        const dynamicModels = await dynamicProvider.getModels(
          account.credential,
          account.id,
        );
        return dynamicModels;
      } catch (e) {
        logger.error(`Failed to fetch dynamic models for ${providerId}:`, e);
      }
    } else {
      logger.warn(`No account found for ${providerId} to fetch models`);
    }
  }

  return [];
};

export const isProviderEnabled = async (
  providerId: string,
): Promise<boolean> => {
  const remoteConfig = await fetchProviderConfig();
  const config = remoteConfig.find((c: any) => c.provider_id === providerId);
  return config ? config.is_enabled : false;
};

export interface ModelWithProvider {
  id: string;
  name: string;
  provider_id: string;
  provider_name: string;
  is_thinking?: boolean;
  context_length?: number | null;
}

export const getAllModelsFromEnabledProviders = async (): Promise<
  ModelWithProvider[]
> => {
  const remoteConfig = await fetchProviderConfig();
  const enabledProviders = remoteConfig.filter((c: any) => c.is_enabled);

  const allModels: ModelWithProvider[] = [];

  for (const provider of enabledProviders) {
    // 1. Static models from config
    if (provider.models && Array.isArray(provider.models)) {
      for (const model of provider.models) {
        allModels.push({
          id: model.id,
          name: model.name,
          provider_id: provider.provider_id,
          provider_name: provider.provider_name,
          is_thinking: model.is_thinking || false,
          context_length:
            model.context_length !== undefined ? model.context_length : null,
        });
      }
    } else {
      // 2. Fallback to dynamic models from provider registry
      const dynamicProvider = providerRegistry.getProvider(
        provider.provider_id,
      );
      if (dynamicProvider && dynamicProvider.getModels) {
        const db = getDb();
        const account = db
          .prepare(
            'SELECT * FROM accounts WHERE LOWER(provider_id) = ? LIMIT 1',
          )
          .get(provider.provider_id.toLowerCase()) as any;

        if (account) {
          try {
            const dynamicModels = await dynamicProvider.getModels(
              account.credential,
              account.id,
            );
            for (const model of dynamicModels) {
              allModels.push({
                id: model.id,
                name: model.name,
                provider_id: provider.provider_id,
                provider_name: provider.provider_name,
                is_thinking: model.is_thinking || false,
                context_length:
                  model.context_length !== undefined
                    ? model.context_length
                    : null,
              });
            }
          } catch (e) {
            logger.error(
              `Failed to fetch dynamic models for ${provider.provider_id} in getAllModels:`,
              e,
            );
          }
        }
      }
    }
  }

  return allModels;
};
