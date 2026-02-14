import fetch from 'node-fetch';
import { createLogger } from '../utils/logger';
import { providerRegistry } from '../provider/registry';
import { getDb } from './db';
import {
  getCachedModels,
  getModelsForProvider,
  isDynamicProvider,
} from './models-sync.service';

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
  total_accounts?: number;
  models?: {
    id: string;
    name: string;
    is_thinking?: boolean;
    context_length?: number | null;
    success_rate?: number;
    max_req_conversation?: number;
    max_token_conversation?: number;
  }[];
  connection_mode?: string;
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
    // 1. Try GitHub (Remote) first
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(PROVIDERS_URL, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data: any = await response.json();
        let parsed: any[] = [];
        if (Array.isArray(data)) parsed = data;
        else if (data && data.data) parsed = data.data;

        if (parsed.length > 0) {
          logger.info('Successfully updated providers from remote.');
          return parsed;
        }
      } else {
        logger.error(`GitHub fetch failed: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error fetching from GitHub', error);
    }

    // 2. If remote fails, fallback to local file
    try {
      const fs = require('fs');
      const path = require('path');
      const possiblePaths = [
        path.join(process.cwd(), 'provider.json'),
        path.join(process.cwd(), 'resources', 'provider.json'),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const data = fs.readFileSync(p, 'utf-8');
          const parsed = JSON.parse(data);
          const config = Array.isArray(parsed) ? parsed : parsed.data || [];
          if (config.length > 0) {
            logger.info(`Loaded providers from local fallback: ${p}`);
            return config;
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load local provider.json fallback', error);
    }

    // 3. Last resort: Return existing cache if available (even if expired)
    if (cachedConfig && cachedConfig.length > 0) {
      logger.warn('Using expired cache as fallback due to fetch failure.');
      return cachedConfig;
    }

    return [];
  };

  let result = await tryFetch();

  // If still empty and empty result, we might return empty array but that causes "disabled" errors.
  // We can try to constructing a minimal default config if absolutely everything fails?
  // But preferably local provider.json should exist.

  if (result.length > 0) {
    // Sanitize: Remove legacy id and name fields if they exist in the source JSON
    const sanitized = result.map((p: any) => {
      const { id, name, ...rest } = p;
      return rest;
    });

    cachedConfig = sanitized;
    cacheTime = Date.now();
    return sanitized;
  }

  return [];
};

export const getAllProviders = async (): Promise<Provider[]> => {
  const config = await fetchProviderConfig();
  const db = getDb();

  // Get account counts from DB
  const dbProviders = db
    .prepare('SELECT id, total_accounts FROM providers')
    .all() as {
    id: string;
    total_accounts: number;
  }[];

  // Get model stats from DB
  const dbModelStats = db
    .prepare('SELECT * FROM provider_models')
    .all() as any[];
  const modelStatsMap = new Map<string, any>();
  dbModelStats.forEach((stat) => {
    // Key: provider_id:model_id (using lowercase for safer matching if needed, but IDs should be consistent)
    modelStatsMap.set(`${stat.provider_id}:${stat.model_id}`, stat);
  });

  // Use lowercase keys for case-insensitive matching
  const countsMap = new Map(
    dbProviders.map((p) => [p.id.toLowerCase(), p.total_accounts]),
  );

  // Build providers with models
  const providersWithModels: Provider[] = [];

  for (const p of config) {
    let models = p.models;

    // If no static models in config, try to get from cache or dynamic fetch
    if (!models || !Array.isArray(models) || models.length === 0) {
      // First check cache
      const cachedModels = getCachedModels(p.provider_id);
      if (cachedModels.length > 0) {
        models = cachedModels;
      } else if (isDynamicProvider(p.provider_id)) {
        // Try to fetch dynamically (but don't block too long)
        try {
          const dynamicModels = await getModelsForProvider(p.provider_id);
          if (dynamicModels.length > 0) {
            models = dynamicModels;
          }
        } catch (e) {
          logger.warn(`Failed to get dynamic models for ${p.provider_id}:`, e);
        }
      }
    }

    // Merge stats into models
    let modelsWithStats: any[] | undefined = undefined;
    if (models && Array.isArray(models)) {
      modelsWithStats = models.map((m: any) => {
        const stats =
          modelStatsMap.get(`${p.provider_id}:${m.id || m.model_id}`) || {};
        const total = stats.total_requests || 0;
        const success = stats.successful_requests || 0;
        const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

        // Filter out internal fields if necessary, or just spread
        return {
          ...m,
          success_rate: successRate,
          max_req_conversation: stats.max_req_conversation || 0,
          max_token_conversation: stats.max_token_conversation || 0,
        };
      });
    }

    providersWithModels.push({
      ...p,
      total_accounts: countsMap.get(p.provider_id.toLowerCase()) || 0,
      models: modelsWithStats,
    });
  }

  return providersWithModels;
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

  // 1. Check if this is a dynamic provider and use cache/sync service
  if (isDynamicProvider(providerId)) {
    try {
      const models = await getModelsForProvider(providerId);
      if (models.length > 0) {
        return models;
      }
    } catch (e) {
      logger.warn(
        `Failed to get models from sync service for ${providerId}:`,
        e,
      );
    }
  }

  // 2. Return static models from config if available
  if (provider && provider.models && Array.isArray(provider.models)) {
    return provider.models.map((m: any) => ({
      id: m.id,
      name: m.name,
      is_thinking: m.is_thinking || false,
      context_length: m.context_length !== undefined ? m.context_length : null,
    }));
  }

  // 3. Fallback to direct provider registry call
  // 3. Fallback to direct provider registry call
  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (dynamicProvider && dynamicProvider.getModels) {
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE LOWER(provider_id) = ? LIMIT 1')
      .get(providerId.toLowerCase()) as any;

    try {
      const credential = account ? account.credential : '';
      const accountId = account ? account.id : undefined;

      const dynamicModels = await dynamicProvider.getModels(
        credential,
        accountId,
      );
      if (dynamicModels && dynamicModels.length > 0) {
        return dynamicModels;
      }
    } catch (e) {
      logger.error(
        `[DEBUG] Failed to fetch dynamic models for ${providerId}:`,
        e,
      );
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
